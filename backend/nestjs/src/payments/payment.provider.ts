import { createHmac, createHash, randomUUID, timingSafeEqual } from 'node:crypto';

export type PaymentProviderEvent = {
  eventId: string;
  type: 'SUCCEEDED' | 'FAILED';
  providerReference: string;
  transactionReference: string;
  amount: string;
  currency: string;
  payloadHash: string;
  attemptId?: string;
};

export type PaymentCreateInput = {
  paymentId: string;
  attemptId: string;
  amount: string;
  currency: string;
  bookingNumber: string;
};

export type PaymentCreateResult = {
  providerReference: string;
  checkoutUrl: string;
};

export type PaymentRefundResult = {
  providerReference: string;
  eventId: string;
  transactionReference: string;
  payloadHash: string;
};

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: PaymentCreateInput): Promise<PaymentCreateResult>;
  refund(input: { paymentId: string; refundId: string; amount: string; currency: string; providerReference: string }): Promise<PaymentRefundResult>;
  verifyWebhook(rawBody: Buffer, signature: string | undefined): PaymentProviderEvent;
}

type TapObject = Record<string, any>;
export class TapPaymentProvider implements PaymentProvider {
  readonly name = 'tap';
  constructor(private readonly secretKey: string, private readonly webhookUrl: string,
    private readonly redirectUrl: string, private readonly request: typeof fetch = fetch) {}

  private async post(path: string, body: object): Promise<TapObject> {
    let response: Response;
    try {
      response = await this.request(`https://api.tap.company/v2/${path}`, { method: 'POST',
        signal: AbortSignal.timeout(10_000), headers: { authorization: `Bearer ${this.secretKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(body) });
    } catch { throw new Error('TAP_PROVIDER_UNAVAILABLE'); }
    if (!response.ok) throw new Error('TAP_PROVIDER_REJECTED');
    try { return await response.json() as TapObject; } catch { throw new Error('TAP_PROVIDER_INVALID_RESPONSE'); }
  }

  async createPayment(input: PaymentCreateInput): Promise<PaymentCreateResult> {
    if (input.currency !== 'JOD' || !/^\d+(\.\d{1,2})?$/.test(input.amount) || Number(input.amount) <= 0)
      throw new Error('PAYMENT_CURRENCY_OR_AMOUNT_INVALID');
    const result = await this.post('charges/', { amount: Number(input.amount), currency: 'JOD', threeDSecure: true,
      save_card: false, description: 'Home Clean booking', reference: { order: input.bookingNumber,
        transaction: input.attemptId, idempotent: input.attemptId }, source: { id: 'src_all' },
      redirect: { url: this.redirectUrl }, post: { url: this.webhookUrl } });
    if (typeof result.id !== 'string' || !result.id.startsWith('chg_') || result.currency !== 'JOD' ||
        Number(result.amount) !== Number(input.amount) || result.reference?.idempotent !== input.attemptId ||
        typeof result.transaction?.url !== 'string' || !result.transaction.url.startsWith('https://'))
      throw new Error('TAP_PROVIDER_INVALID_RESPONSE');
    return { providerReference: result.id, checkoutUrl: result.transaction.url };
  }

  async refund(input: { paymentId: string; refundId: string; amount: string; currency: string; providerReference: string }): Promise<PaymentRefundResult> {
    if (input.currency !== 'JOD' || !input.providerReference.startsWith('chg_') || !/^\d+(\.\d{1,2})?$/.test(input.amount)) throw new Error('REFUND_REFERENCE_INVALID');
    const result = await this.post('refunds/', { charge_id: input.providerReference, amount: Number(input.amount),
      currency: 'JOD', reason: 'requested_by_customer', reference: { idempotent: input.refundId, transaction: input.paymentId },
      post: { url: this.webhookUrl } });
    if (typeof result.id !== 'string' || !result.id.startsWith('re_') || result.status !== 'REFUNDED' ||
        result.charge_id !== input.providerReference || result.currency !== 'JOD' || Number(result.amount) !== Number(input.amount) ||
        result.reference?.idempotent !== input.refundId)
      throw new Error('TAP_REFUND_PENDING_OR_FAILED');
    return { providerReference: result.id, eventId: `tap-refund:${result.id}`, transactionReference: result.id,
      payloadHash: createHash('sha256').update(JSON.stringify(result)).digest('hex') };
  }

  verifyWebhook(rawBody: Buffer, signature: string | undefined): PaymentProviderEvent {
    if (!signature || !/^[a-f0-9]{64}$/i.test(signature) || rawBody.length > 64_000) throw new Error('TAP_WEBHOOK_INVALID');
    let body: TapObject;
    try { body = JSON.parse(rawBody.toString('utf8')) as TapObject; } catch { throw new Error('TAP_WEBHOOK_INVALID'); }
    if (body.object !== 'charge' || typeof body.id !== 'string' || !body.id.startsWith('chg_') ||
        !['CAPTURED', 'FAILED', 'DECLINED', 'CANCELLED'].includes(body.status) || body.currency !== 'JOD' ||
        !Number.isFinite(Number(body.amount)) || typeof body.transaction?.created !== 'string' ||
        typeof body.reference?.payment !== 'string' || typeof body.reference?.idempotent !== 'string') throw new Error('TAP_WEBHOOK_INVALID');
    const amount = Number(body.amount).toFixed(3);
    const signed = `x_id${body.id}x_amount${amount}x_currency${body.currency}x_gateway_reference${body.reference.gateway ?? ''}` +
      `x_payment_reference${body.reference.payment}x_status${body.status}x_created${body.transaction.created}`;
    const expected = createHmac('sha256', this.secretKey).update(signed).digest();
    const provided = Buffer.from(signature, 'hex');
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) throw new Error('TAP_WEBHOOK_INVALID');
    return { eventId: `${body.id}:${body.status}:${body.transaction.created}`, type: body.status === 'CAPTURED' ? 'SUCCEEDED' : 'FAILED',
      providerReference: body.id, transactionReference: body.id, amount, currency: 'JOD',
      attemptId: typeof body.reference.idempotent === 'string' ? body.reference.idempotent : undefined,
      payloadHash: createHash('sha256').update(rawBody).digest('hex') };
  }
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 160) throw new Error(`Invalid provider field: ${field}`);
  return value;
}

/**
 * Deterministic local adapter. It models the server/provider contract without
 * claiming a connection to a real Jordanian gateway.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  constructor(private readonly secret: string) {}

  async createPayment(input: PaymentCreateInput) {
    const providerReference = `mock-pay-${randomUUID()}`;
    return { providerReference, checkoutUrl: `https://mock-payments.invalid/checkout/${providerReference}` };
  }

  async refund(input: { paymentId: string; refundId: string; amount: string; currency: string; providerReference: string }) {
    const providerReference = `mock-refund-${randomUUID()}`;
    const transactionReference = `mock-refund-txn-${randomUUID()}`;
    const payloadHash = createHash('sha256').update(`${input.refundId}:${providerReference}:${input.amount}`).digest('hex');
    return { providerReference, eventId: `mock-refund-event-${randomUUID()}`, transactionReference, payloadHash };
  }

  verifyWebhook(rawBody: Buffer, signature: string | undefined): PaymentProviderEvent {
    if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) throw new Error('Invalid webhook signature');
    const expected = createHmac('sha256', this.secret).update(rawBody).digest('hex');
    const provided = Buffer.from(signature, 'hex');
    const calculated = Buffer.from(expected, 'hex');
    if (provided.length !== calculated.length || !timingSafeEqual(provided, calculated)) throw new Error('Invalid webhook signature');
    let body: Record<string, unknown>;
    try { body = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>; } catch { throw new Error('Invalid webhook payload'); }
    const type = body.type === 'SUCCEEDED' || body.type === 'FAILED' ? body.type : undefined;
    if (!type) throw new Error('Invalid webhook event type');
    const amount = requiredString(body.amount, 'amount');
    const currency = requiredString(body.currency, 'currency');
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || !/^[A-Z]{3}$/.test(currency)) throw new Error('Invalid provider amount/currency');
    return {
      eventId: requiredString(body.eventId, 'eventId'),
      type,
      providerReference: requiredString(body.paymentReference, 'paymentReference'),
      transactionReference: requiredString(body.transactionReference ?? body.paymentReference, 'transactionReference'),
      amount,
      currency,
      payloadHash: createHash('sha256').update(rawBody).digest('hex'),
    };
  }
}
