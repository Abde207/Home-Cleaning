import { createHmac, createHash, randomUUID, timingSafeEqual } from 'node:crypto';

export type PaymentProviderEvent = {
  eventId: string;
  type: 'SUCCEEDED' | 'FAILED';
  providerReference: string;
  transactionReference: string;
  amount: string;
  currency: string;
  payloadHash: string;
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
