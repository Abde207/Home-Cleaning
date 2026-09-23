import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma, type PaymentStatus } from '@prisma/client';
import { PrismaService } from '../database/database.module.js';
import type { Actor } from '../auth/authorization.js';
import { audit } from '../core/core.policy.js';
import { MockPaymentProvider, TapPaymentProvider, type PaymentProvider } from './payment.provider.js';
import type { CreatePaymentDto, PaymentRefundDto } from './payment.dto.js';
import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';

type Tx = Prisma.TransactionClient;

function jsonValue(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
function requestHash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function stableUuid(value: string) {
  const hex = createHash('sha256').update(value).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function permission(actor: Actor, code: string) { return actor.scopes.some(scope => scope.permissions.includes(code)); }
function anyPermission(actor: Actor, codes: string[]) { return codes.some(code => permission(actor, code)); }

@Injectable()
export class PaymentService {
  private readonly provider: PaymentProvider;

  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(ConfigService) config: ConfigService) {
    this.provider = config.get('PAYMENT_PROVIDER') === 'tap'
      ? new TapPaymentProvider(config.getOrThrow('TAP_SECRET_KEY'), config.getOrThrow('TAP_WEBHOOK_URL'), config.getOrThrow('TAP_REDIRECT_URL'))
      : new MockPaymentProvider(config.getOrThrow<string>('PAYMENT_WEBHOOK_SECRET'));
  }

  private requireKey(key: string | undefined) {
    if (!key || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    return key;
  }

  private async idempotent<T>(actor: Actor, key: string | undefined, operation: string, payload: unknown, work: (tx: Tx) => Promise<T>) {
    const idempotencyKey = this.requireKey(key);
    const hash = requestHash(payload);
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${actor.userId}:${operation}:${idempotencyKey}`}))`;
      const existing = await tx.idempotencyKey.findUnique({ where: { userId_operation_key: { userId: actor.userId, operation, key: idempotencyKey } } });
      if (existing) {
        if (existing.requestHash !== hash) throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
        return existing.response as T;
      }
      const result = await work(tx);
      await tx.idempotencyKey.create({ data: { userId: actor.userId, operation, key: idempotencyKey, requestHash: hash, response: jsonValue(result) } });
      return result;
    });
  }

  private async lockBooking(tx: Tx, actor: Actor, bookingId: string, customerOnly = false) {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId}::uuid FOR UPDATE`;
    const customer = permission(actor, 'payment:own') && !anyPermission(actor, ['payment:manage', 'refund:manage', 'booking:operations'])
      ? await tx.customer.findUnique({ where: { userId: actor.userId }, select: { id: true } }) : null;
    const booking = await tx.booking.findFirst({
      where: { id: bookingId, ...(customerOnly || customer ? { customerId: customer?.id ?? '__missing__' } : {}) },
      select: { id: true, customerId: true, bookingNumber: true, status: true, price: true, currency: true, paymentMethod: true, version: true },
    });
    if (!booking) throw new NotFoundException();
    return booking;
  }

  private async lockPayment(tx: Tx, paymentId: string) {
    await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${paymentId}::uuid FOR UPDATE`;
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { booking: true, refunds: true, attempts: { orderBy: { attemptNumber: 'desc' } } } });
    if (!payment) throw new NotFoundException();
    return payment;
  }

  private async ownerOrFinance(actor: Actor, payment: { booking: { customerId: string } }) {
    if (anyPermission(actor, ['payment:manage', 'refund:manage', 'booking:operations'])) return;
    if (permission(actor, 'cash:team') || permission(actor, 'settlement:company')) return;
    if (!permission(actor, 'payment:own')) throw new ForbiddenException();
    const customer = await this.db.customer.findUnique({ where: { userId: actor.userId }, select: { id: true } });
    if (!customer || customer.id !== payment.booking.customerId) throw new NotFoundException();
  }

  private async paymentHistory(tx: Tx, paymentId: string, previousStatus: PaymentStatus | null, newStatus: PaymentStatus, reason: string, actorUserId?: string, provider?: string, eventId?: string) {
    if (previousStatus === newStatus) return;
    await tx.paymentStatusHistory.create({ data: { paymentId, previousStatus, newStatus, reason, ...(actorUserId ? { changedByUserId: actorUserId } : {}), ...(provider ? { provider } : {}), ...(eventId ? { eventId } : {}) } });
    await tx.outboxEvent.create({ data: { type: 'PAYMENT_STATUS_CHANGED', aggregateId: paymentId, payload: jsonValue({ paymentId, previousStatus, newStatus, reason, eventId: eventId ?? null }) } });
  }

  private async paymentAudit(tx: Tx, actorUserId: string | null, requestId: string, action: string, resourceType: string, resourceId: string, after: object, before?: object) {
    if (actorUserId) return audit(tx, { actor: { userId: actorUserId, sessionId: 'payment', familyId: 'payment', scopes: [] }, requestId }, action, resourceType, resourceId, after, before);
    await tx.auditLog.create({ data: { actorUserId: null, requestId, action, resourceType, resourceId, after: jsonValue(after), ...(before ? { before: jsonValue(before) } : {}) } });
  }

  private async bookingTransition(tx: Tx, actorUserId: string | null, booking: { id: string; status: any; version: number }, next: any, action: string, metadata: object) {
    const allowed: Record<string, string[]> = { PRICE_CONFIRMED: ['PAYMENT_PENDING'], PAYMENT_PENDING: ['PAYMENT_CONFIRMED'], PAYMENT_RECONCILIATION: ['REFUND_PENDING'], REFUND_PENDING: ['REFUNDED'] };
    if (!allowed[booking.status]?.includes(next)) throw new ConflictException({ code: 'BOOKING_INVALID_TRANSITION' });
    const updated = await tx.booking.update({ where: { id: booking.id }, data: { status: next, version: { increment: 1 } }, select: { id: true, bookingNumber: true, status: true, paymentMethod: true, price: true, currency: true, scheduledAt: true, estimatedEndAt: true, createdAt: true } });
    await tx.bookingStatusHistory.create({ data: { bookingId: booking.id, previousStatus: booking.status, newStatus: next, changedByUserId: actorUserId, metadata: jsonValue(metadata) } });
    await tx.outboxEvent.create({ data: { type: 'BOOKING_STATUS_CHANGED', aggregateId: booking.id, payload: jsonValue({ bookingId: booking.id, previousStatus: booking.status, newStatus: next, action, metadata }) } });
    await this.paymentAudit(tx, actorUserId, `payment:${booking.id}`, action, 'Booking', booking.id, { status: next, version: booking.version + 1 }, { status: booking.status, version: booking.version });
    return updated;
  }

  private paymentResponse(payment: any, attempt: any) {
    return { id: payment.id, bookingId: payment.bookingId, status: payment.status, method: payment.method, amount: payment.amount, currency: payment.currency, provider: payment.provider, providerReference: payment.transactionReference, attempt: attempt ? { id: attempt.id, status: attempt.status, providerReference: attempt.providerReference, checkoutUrl: attempt.checkoutUrl, attemptNumber: attempt.attemptNumber } : null };
  }

  async create(actor: Actor, dto: CreatePaymentDto, key: string | undefined) {
    if (!permission(actor, 'payment:own') && !permission(actor, 'payment:manage')) throw new ForbiddenException();
    return this.idempotent(actor, key, 'PAYMENT_CREATE', dto, async tx => {
      const booking = await this.lockBooking(tx, actor, dto.bookingId, permission(actor, 'payment:own') && !permission(actor, 'payment:manage'));
      if (!['PRICE_CONFIRMED', 'PAYMENT_PENDING'].includes(booking.status)) throw new ConflictException({ code: 'PAYMENT_INITIATION_NOT_ALLOWED' });
      let payment = await tx.payment.findFirst({ where: { bookingId: booking.id, method: 'ONLINE' }, orderBy: { createdAt: 'desc' }, include: { attempts: { orderBy: { attemptNumber: 'desc' } } } });
      if (!payment) {
        payment = await tx.payment.create({ data: { bookingId: booking.id, method: 'ONLINE', status: 'PENDING', amount: booking.price, currency: booking.currency }, include: { attempts: { orderBy: { attemptNumber: 'desc' } } } });
        await this.paymentHistory(tx, payment.id, null, 'PENDING', 'ONLINE_PAYMENT_CREATED', actor.userId);
        await tx.booking.update({ where: { id: booking.id }, data: { paymentMethod: 'ONLINE' } });
        if (booking.status === 'PRICE_CONFIRMED') await this.bookingTransition(tx, actor.userId, booking, 'PAYMENT_PENDING', 'BOOKING_ONLINE_PAYMENT_INITIATED', { command: 'InitiateOnlinePayment' });
      }
      if (payment.status === 'CONFIRMED' || payment.status === 'RECONCILED') throw new ConflictException({ code: 'PAYMENT_ALREADY_CONFIRMED' });
      const existing = payment.attempts.find(attempt => attempt.requestKey === this.requireKey(key));
      if (existing?.providerReference) return this.paymentResponse(payment, existing);
      const attempt = existing ?? await tx.paymentAttempt.create({ data: { id: stableUuid(`payment-create:${actor.userId}:${booking.id}:${this.requireKey(key)}`), paymentId: payment.id, provider: this.provider.name, attemptNumber: payment.attempts.length + 1, status: 'INITIATED', requestKey: this.requireKey(key), amount: payment.amount, currency: payment.currency } });
      const customer = await tx.customer.findUniqueOrThrow({ where: { id: booking.customerId }, select: { user: { select: { phone: true } } } });
      const created = await this.provider.createPayment({ paymentId: payment.id, attemptId: attempt.id, amount: payment.amount.toString(), currency: payment.currency, bookingNumber: booking.bookingNumber, customerPhone: customer.user.phone });
      const updatedAttempt = await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'PENDING', providerReference: created.providerReference, checkoutUrl: created.checkoutUrl } });
      const updatedPayment = await tx.payment.update({ where: { id: payment.id }, data: { provider: this.provider.name, transactionReference: created.providerReference } });
      await audit(tx, { actor, requestId: `payment-create:${key}` }, 'PAYMENT_INITIATED', 'Payment', payment.id, { bookingId: booking.id, provider: this.provider.name, attemptId: attempt.id });
      return this.paymentResponse(updatedPayment, updatedAttempt);
    });
  }

  async retry(actor: Actor, paymentId: string, key: string | undefined) {
    if (!anyPermission(actor, ['payment:own', 'payment:manage'])) throw new ForbiddenException();
    return this.idempotent(actor, key, 'PAYMENT_RETRY', { paymentId }, async tx => {
      const payment = await this.lockPayment(tx, paymentId);
      if (permission(actor, 'payment:own') && !permission(actor, 'payment:manage') && payment.booking.customerId !== (await tx.customer.findUnique({ where: { userId: actor.userId }, select: { id: true } }))?.id) throw new NotFoundException();
      if (payment.method !== 'ONLINE' || payment.status !== 'FAILED' || payment.booking.status !== 'PAYMENT_PENDING') throw new ConflictException({ code: 'PAYMENT_RETRY_NOT_ALLOWED' });
      const attempt = await tx.paymentAttempt.create({ data: { id: stableUuid(`payment-retry:${actor.userId}:${paymentId}:${this.requireKey(key)}`), paymentId, provider: this.provider.name, attemptNumber: payment.attempts.length + 1, status: 'INITIATED', requestKey: this.requireKey(key), amount: payment.amount, currency: payment.currency } });
      await this.paymentHistory(tx, payment.id, 'FAILED', 'PENDING', 'ONLINE_PAYMENT_RETRY', actor.userId);
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'PENDING' } });
      const customer = await tx.customer.findUniqueOrThrow({ where: { id: payment.booking.customerId }, select: { user: { select: { phone: true } } } });
      const created = await this.provider.createPayment({ paymentId, attemptId: attempt.id, amount: payment.amount.toString(), currency: payment.currency, bookingNumber: payment.booking.bookingNumber, customerPhone: customer.user.phone });
      const updatedAttempt = await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'PENDING', providerReference: created.providerReference, checkoutUrl: created.checkoutUrl } });
      const updatedPayment = await tx.payment.update({ where: { id: payment.id }, data: { provider: this.provider.name, transactionReference: created.providerReference } });
      await audit(tx, { actor, requestId: `payment-retry:${key}` }, 'PAYMENT_RETRIED', 'Payment', payment.id, { attemptId: attempt.id });
      return this.paymentResponse(updatedPayment, updatedAttempt);
    });
  }

  async webhook(providerName: string, rawBody: Buffer, signature: string | undefined) {
    if (providerName !== this.provider.name) throw new NotFoundException();
    let event;
    try { event = this.provider.verifyWebhook(rawBody, signature); } catch { throw new UnauthorizedException({ code: 'PAYMENT_WEBHOOK_SIGNATURE_INVALID' }); }
    try {
      const result = await this.db.$transaction(async tx => {
        const existing = await tx.paymentEvent.findUnique({ where: { provider_eventId: { provider: providerName, eventId: event.eventId } } });
        if (existing) {
          if (existing.payloadHash !== event.payloadHash || !existing.signatureVerified) throw new ConflictException({ code: 'PAYMENT_WEBHOOK_REPLAY_MISMATCH' });
          return { accepted: existing.type === 'PAYMENT_CONFIRMED', duplicate: true, paymentId: existing.paymentId, eventId: event.eventId, type: existing.type };
        }
        const attempt = await tx.paymentAttempt.findUnique({ where: { provider_providerReference: { provider: providerName, providerReference: event.providerReference } }, include: { payment: { include: { booking: true } } } });
        if (!attempt) throw new ConflictException({ code: 'PAYMENT_PROVIDER_REFERENCE_UNKNOWN' });
        await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${attempt.paymentId}::uuid FOR UPDATE`;
        const payment = await tx.payment.findUniqueOrThrow({ where: { id: attempt.paymentId }, include: { booking: true } });
        const amount = new Prisma.Decimal(event.amount);
        const amountMatches = amount.eq(payment.amount) && event.currency === payment.currency;
        if (event.attemptId !== undefined && event.attemptId !== attempt.id) throw new ConflictException({ code: 'PAYMENT_ATTEMPT_REFERENCE_MISMATCH' });
        if (event.bookingReference !== undefined && event.bookingReference !== payment.booking.bookingNumber)
          throw new ConflictException({ code: 'PAYMENT_BOOKING_REFERENCE_MISMATCH' });
        const eventType = event.type === 'SUCCEEDED' ? 'PAYMENT_CONFIRMED' : 'PAYMENT_FAILED';
        await tx.paymentEvent.create({ data: { paymentId: payment.id, provider: providerName, eventId: event.eventId, type: amountMatches ? eventType : 'PAYMENT_REJECTED_AMOUNT', payloadHash: event.payloadHash, signatureVerified: true, verifiedAt: new Date() } });
        if (!amountMatches) {
          await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'FAILED', failureCode: 'PAYMENT_AMOUNT_MISMATCH', failureMessage: 'Verified provider amount/currency did not match the server-owned payment.' } });
          await this.paymentAudit(tx, null, `webhook:${event.eventId}`, 'PAYMENT_WEBHOOK_REJECTED', 'Payment', payment.id, { eventId: event.eventId, reason: 'PAYMENT_AMOUNT_MISMATCH' });
          return { accepted: false, duplicate: false, paymentId: payment.id, eventId: event.eventId, type: 'PAYMENT_REJECTED_AMOUNT' };
        }
        if (event.type === 'FAILED') {
          await this.paymentHistory(tx, payment.id, payment.status, 'FAILED', 'PROVIDER_PAYMENT_FAILED', undefined, providerName, event.eventId);
          await tx.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
          await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'FAILED', failureCode: 'PROVIDER_PAYMENT_FAILED' } });
          await this.paymentAudit(tx, null, `webhook:${event.eventId}`, 'PAYMENT_FAILED', 'Payment', payment.id, { eventId: event.eventId });
          return { accepted: false, duplicate: false, paymentId: payment.id, eventId: event.eventId, type: 'PAYMENT_FAILED' };
        }
        if (payment.status !== 'PENDING' || payment.booking.status !== 'PAYMENT_PENDING') throw new ConflictException({ code: 'PAYMENT_STATE_MISMATCH' });
        await tx.paymentTransaction.create({ data: { paymentId: payment.id, type: 'CAPTURE', amount: payment.amount, reference: event.transactionReference } });
        await this.paymentHistory(tx, payment.id, payment.status, 'CONFIRMED', 'PROVIDER_PAYMENT_CONFIRMED', undefined, providerName, event.eventId);
        await tx.payment.update({ where: { id: payment.id }, data: { status: 'CONFIRMED' } });
        await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'SUCCEEDED' } });
        await this.bookingTransition(tx, null, payment.booking, 'PAYMENT_CONFIRMED', 'BOOKING_PAYMENT_CONFIRMED', { command: 'VerifiedPaymentWebhook', provider: providerName, eventId: event.eventId });
        await this.paymentAudit(tx, null, `webhook:${event.eventId}`, 'PAYMENT_VERIFIED', 'Payment', payment.id, { eventId: event.eventId, provider: providerName });
        return { accepted: true, duplicate: false, paymentId: payment.id, eventId: event.eventId, type: 'PAYMENT_CONFIRMED' };
      });
      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = await this.db.paymentEvent.findUnique({ where: { provider_eventId: { provider: providerName, eventId: event.eventId } } });
        if (duplicate?.payloadHash === event.payloadHash) return { accepted: duplicate.type === 'PAYMENT_CONFIRMED', duplicate: true, paymentId: duplicate.paymentId, eventId: event.eventId, type: duplicate.type };
      }
      throw error;
    }
  }

  async get(actor: Actor, paymentId: string) {
    const payment = await this.db.payment.findUnique({ where: { id: paymentId }, include: { booking: true, attempts: { orderBy: { createdAt: 'asc' } }, statusHistory: { orderBy: { createdAt: 'asc' } }, transactions: { orderBy: { createdAt: 'asc' } }, events: { orderBy: { createdAt: 'asc' } }, refunds: { orderBy: { createdAt: 'asc' } }, cashCollection: true } });
    if (!payment) throw new NotFoundException();
    await this.ownerOrFinance(actor, payment);
    if (permission(actor, 'cash:team') && !anyPermission(actor, ['payment:manage', 'payment:own', 'refund:manage'])) {
      const allowed = await this.db.assignment.findFirst({ where: { bookingId: payment.bookingId, ...this.teamScope(actor) }, select: { id: true } });
      if (!allowed) throw new NotFoundException();
    }
    if (permission(actor, 'settlement:company') && !anyPermission(actor, ['payment:manage', 'payment:own', 'refund:manage', 'cash:team'])) {
      const allowed = await this.db.assignment.findFirst({ where: { bookingId: payment.bookingId, companyId: { in: actor.scopes.filter(scope => scope.permissions.includes('settlement:company') && scope.companyId).map(scope => scope.companyId!) } }, select: { id: true } });
      if (!allowed) throw new NotFoundException();
    }
    return { id: payment.id, bookingId: payment.bookingId, method: payment.method, status: payment.status, amount: payment.amount, currency: payment.currency, provider: payment.provider, providerReference: payment.transactionReference, attempts: payment.attempts, statusHistory: payment.statusHistory, transactions: payment.transactions, events: payment.events.map(event => ({ id: event.id, provider: event.provider, eventId: event.eventId, type: event.type, signatureVerified: event.signatureVerified, createdAt: event.createdAt })), refunds: payment.refunds, cashCollection: payment.cashCollection };
  }

  private teamScope(actor: Actor): Prisma.AssignmentWhereInput {
    const scopes = actor.scopes.flatMap(scope => scope.role === 'COMPANY_MANAGER' && scope.companyId ? [{ companyId: scope.companyId }] : scope.role === 'TEAM_LEADER_CLEANER' && scope.companyId && scope.teamId ? [{ companyId: scope.companyId, teamId: scope.teamId }] : []);
    if (!scopes.length) throw new ForbiddenException();
    return { OR: scopes };
  }

  async requestRefund(actor: Actor, paymentId: string, dto: PaymentRefundDto, key: string | undefined) {
    if (!anyPermission(actor, ['refund:manage', 'payment:manage'])) throw new ForbiddenException();
    return this.idempotent(actor, key, 'REFUND_CREATE', { paymentId, ...dto }, async tx => {
      const payment = await this.lockPayment(tx, paymentId);
      if (payment.booking.status !== 'PAYMENT_RECONCILIATION' || !['RECONCILED'].includes(payment.status)) throw new ConflictException({ code: 'REFUND_NOT_ALLOWED' });
      const amount = new Prisma.Decimal(dto.amount);
      const successful = payment.refunds.filter(refund => refund.status === 'SUCCEEDED').reduce((sum, refund) => sum.add(refund.amount), new Prisma.Decimal(0));
      const pending = payment.refunds.filter(refund => refund.status === 'PENDING').reduce((sum, refund) => sum.add(refund.amount), new Prisma.Decimal(0));
      if (!amount.gt(0) || amount.gt(payment.amount.sub(successful).sub(pending))) throw new ConflictException({ code: 'REFUND_OVER_LIMIT' });
      const refund = await tx.refund.create({ data: { id: stableUuid(`refund:${actor.userId}:${paymentId}:${this.requireKey(key)}`), paymentId, amount, reason: dto.reason, ...(payment.method === 'ONLINE' ? { provider: this.provider.name } : {}) } });
      await tx.refundHistory.create({ data: { refundId: refund.id, previousStatus: null, newStatus: 'PENDING', reason: dto.reason } });
      await tx.outboxEvent.create({ data: { type: 'REFUND_CREATED', aggregateId: refund.id, payload: jsonValue({ refundId: refund.id, paymentId, bookingId: payment.bookingId, status: 'PENDING' }) } });
      await this.bookingTransition(tx, actor.userId, payment.booking, 'REFUND_PENDING', 'BOOKING_REFUND_REQUESTED', { command: 'CreateRefund', refundId: refund.id });
      if (payment.method === 'CASH') {
        await audit(tx, { actor, requestId: `refund-create:${key}` }, 'REFUND_REQUESTED', 'Refund', refund.id, { paymentId, amount: amount.toString(), method: 'CASH' });
        return { id: refund.id, paymentId, amount: refund.amount, status: refund.status, provider: null, reference: null };
      }
      const providerResult = await this.provider.refund({ paymentId, refundId: refund.id, amount: amount.toString(), currency: payment.currency, providerReference: payment.transactionReference ?? '' });
      await tx.paymentEvent.create({ data: { paymentId, provider: this.provider.name, eventId: providerResult.eventId, type: 'REFUND_SUCCEEDED', payloadHash: providerResult.payloadHash, signatureVerified: true, verifiedAt: new Date() } });
      await tx.paymentTransaction.create({ data: { paymentId, type: 'REFUND', amount, reference: providerResult.transactionReference } });
      const updated = await tx.refund.update({ where: { id: refund.id }, data: { status: 'SUCCEEDED', reference: providerResult.providerReference } });
      await tx.refundHistory.create({ data: { refundId: refund.id, previousStatus: 'PENDING', newStatus: 'SUCCEEDED', provider: this.provider.name, reference: providerResult.providerReference } });
      const total = successful.add(pending).add(amount);
      const nextPayment: PaymentStatus = total.gte(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      await this.paymentHistory(tx, payment.id, payment.status, nextPayment, 'PROVIDER_REFUND_SUCCEEDED', actor.userId, this.provider.name, providerResult.eventId);
      await tx.payment.update({ where: { id: payment.id }, data: { status: nextPayment } });
      await this.bookingTransition(tx, actor.userId, { ...payment.booking, status: 'REFUND_PENDING', version: payment.booking.version + 1 }, 'REFUNDED', 'BOOKING_REFUNDED', { command: 'ProviderRefundSucceeded', refundId: refund.id, reference: providerResult.providerReference });
      await audit(tx, { actor, requestId: `refund-create:${key}` }, 'REFUND_COMPLETED', 'Refund', refund.id, { paymentId, amount: amount.toString(), provider: this.provider.name, reference: providerResult.providerReference });
      return { id: updated.id, paymentId, amount: updated.amount, status: updated.status, provider: this.provider.name, reference: updated.reference };
    });
  }
}
