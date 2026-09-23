import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type BookingStatus, type RoleName } from '@prisma/client';
import { PrismaService } from '../database/database.module.js';
import type { Actor } from '../auth/authorization.js';
import { assignmentScope } from '../auth/authorization.js';
import { audit } from '../core/core.policy.js';
import type { ListQueryDto } from '../core/core.dto.js';
import { assertBookingTransition } from './booking.state.js';
import type { AssignmentDto, CancelBookingDto, CashCollectionDto, CompletionProofDto, CreateBookingDto, PaymentConfirmationDto, QuoteConfirmationDto, RefundCompletionDto, RefundDto } from './booking.dto.js';
import { bookingListSelect, bookingSelect } from './booking.projections.js';
import { PricingService } from '../pricing/pricing.service.js';

type Transaction = Prisma.TransactionClient;
type DispatchActor = Actor | (Omit<Actor, 'userId'> & { userId: null });
export type DispatchBooking = {
  id: string; serviceId: string; status: BookingStatus; version: number;
  scheduledAt: Date; estimatedEndAt: Date; locationLatitude: Prisma.Decimal; locationLongitude: Prisma.Decimal;
};
export type DispatchSelection = { dto?: AssignmentDto; candidates: unknown[]; reason?: string };

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function requestHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function hasPermission(actor: Actor, permission: string) {
  return actor.scopes.some(scope => scope.permissions.includes(permission));
}

function hasAnyPermission(actor: Actor, permissions: string[]) {
  return permissions.some(permission => hasPermission(actor, permission));
}

function primaryRole(actor: DispatchActor, permission: string): RoleName | undefined {
  return actor.scopes.find(scope => scope.permissions.includes(permission))?.role;
}

function bookingNumber() {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `HC-${day}-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}

@Injectable()
export class BookingService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(PricingService) private readonly pricing: PricingService) {}

  private requireIdempotencyKey(key: string | undefined) {
    if (!key || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'A valid Idempotency-Key header is required.' });
    }
    return key;
  }

  private async customerId(tx: Transaction | PrismaService, actor: Actor) {
    const customer = await tx.customer.findUnique({ where: { userId: actor.userId }, select: { id: true } });
    if (!customer) throw new NotFoundException();
    return customer.id;
  }

  private requirePermission(actor: Actor, permissions: string[]) {
    if (!hasAnyPermission(actor, permissions)) throw new ForbiddenException();
  }

  private async scopedWhere(actor: Actor, tx: Transaction | PrismaService): Promise<Prisma.BookingWhereInput> {
    if (hasPermission(actor, 'booking:operations')) return {};
    if (hasPermission(actor, 'booking:own')) return { customerId: await this.customerId(tx, actor) };
    throw new ForbiddenException();
  }

  private async idempotent<T>(actor: Actor, key: string | undefined, operation: string, payload: unknown, work: (tx: Transaction) => Promise<T>) {
    const idempotencyKey = this.requireIdempotencyKey(key);
    const hash = requestHash(payload);
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${actor.userId}:${operation}:${idempotencyKey}`}))`;
      const existing = await tx.idempotencyKey.findUnique({ where: { userId_operation_key: { userId: actor.userId, operation, key: idempotencyKey } } });
      if (existing) {
        if (existing.requestHash !== hash) throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED', message: 'The idempotency key was already used for a different request.' });
        return existing.response as T;
      }
      const result = await work(tx);
      await tx.idempotencyKey.create({ data: { userId: actor.userId, operation, key: idempotencyKey, requestHash: hash, response: jsonValue(result) } });
      return result;
    });
  }

  async list(actor: Actor, page: ListQueryDto = { limit: 100, offset: 0 }) {
    const where = await this.scopedWhere(actor, this.db);
    return this.db.booking.findMany({ where, select: bookingListSelect, orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }], take: page.limit, skip: page.offset });
  }

  async detail(actor: Actor, id: string) {
    const scope = await this.scopedWhere(actor, this.db);
    const booking = await this.db.booking.findFirst({ where: { AND: [{ id }, scope] }, select: bookingSelect });
    if (!booking) throw new NotFoundException();
    return booking;
  }

  async create(actor: Actor, dto: CreateBookingDto, key: string | undefined) {
    return this.idempotent(actor, key, 'BOOKING_CREATE', dto, async tx => {
      const customerId = await this.customerId(tx, actor);
      const scheduledAt = new Date(dto.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) throw new BadRequestException({ code: 'BOOKING_SCHEDULE_INVALID', message: 'scheduledAt must be a valid future instant.' });
      const req = { actor, requestId: `booking-create:${requestHash(key)}` };
      const { quote, snapshot } = await this.pricing.forBooking(tx, req, customerId, dto);
      const { service, property, address, price: calculation, extras: bookingExtras } = snapshot;
      const { basePrice, extrasTotal, total } = calculation;
      const estimatedEndAt = new Date(scheduledAt.getTime() + service.durationMinutes * 60_000);
      const role = primaryRole(actor, 'booking:own');
      const created = await tx.booking.create({
        data: {
          bookingNumber: bookingNumber(), customerId, serviceId: service.id, propertyId: property.id, addressId: address.id,
          scheduledAt, estimatedEndAt, status: 'REQUESTED', price: total, currency: 'JOD',
          addressSnapshot: jsonValue({ id: address.id, label: address.label, addressText: address.addressText, latitude: address.latitude.toString(), longitude: address.longitude.toString() }),
          propertySnapshot: jsonValue({ id: property.id, type: property.type, size: property.size.toString(), rooms: property.rooms, bathrooms: property.bathrooms }),
          serviceSnapshot: jsonValue({ id: service.id, code: service.code, name: service.name, nameAr: service.nameAr, description: service.description, basePrice: service.basePrice.toString(), durationMinutes: service.durationMinutes }),
          locationLatitude: address.latitude, locationLongitude: address.longitude, instructions: dto.instructions,
          extras: { create: bookingExtras },
          priceSnapshot: { create: { pricingVersion: calculation.pricingVersion, basePrice, extrasTotal, adjustments: calculation.adjustments, fees: calculation.fees, discount: calculation.discount, total, currency: calculation.currency, breakdown: jsonValue(calculation.breakdown) } },
          history: { create: { previousStatus: null, newStatus: 'REQUESTED', changedByUserId: actor.userId, ...(role ? { changedByRole: role } : {}), metadata: jsonValue({ command: 'CreateBooking', pricingVersion: calculation.pricingVersion, quoteId: quote.id }) } },
        },
        select: bookingSelect,
      });
      await tx.quoteConsumption.create({ data: { quoteId: quote.id, bookingId: created.id, customerId } });
      await audit(tx, req, 'PRICING_QUOTE_CONSUMED', 'PricingQuote', quote.id, { bookingId: created.id });
      await audit(tx, req, 'BOOKING_CREATED', 'Booking', created.id, { bookingNumber: created.bookingNumber, status: created.status, customerId: created.customerId });
      await tx.outboxEvent.create({ data: { type: 'BOOKING_CREATED', aggregateId: created.id, payload: jsonValue({ bookingId: created.id, status: created.status }) } });
      return created;
    });
  }

  private async locked(actor: DispatchActor, id: string, allowOperations: boolean, tx: Transaction) {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${id}::uuid FOR UPDATE`;
    const scope = actor.userId === null ? {} : allowOperations ? await this.scopedWhere(actor, tx) : { customerId: await this.customerId(tx, actor) };
    const booking = await tx.booking.findFirst({ where: { AND: [{ id }, scope] }, select: { id: true, customerId: true, serviceId: true, status: true, version: true, price: true, currency: true, paymentMethod: true, bookingNumber: true, scheduledAt: true, estimatedEndAt: true, locationLatitude: true, locationLongitude: true } });
    if (!booking) throw new NotFoundException();
    return booking;
  }

  private async lockedPayment(tx: Transaction, bookingId: string) {
    await tx.$queryRaw`SELECT id FROM "Payment" WHERE "bookingId" = ${bookingId}::uuid ORDER BY "createdAt" DESC LIMIT 1 FOR UPDATE`;
    return tx.payment.findFirst({ where: { bookingId }, orderBy: { createdAt: 'desc' }, include: { cashCollection: true, refunds: true } });
  }

  private async lockedAssignment(actor: Actor, assignmentId: string, tx: Transaction) {
    await tx.$queryRaw`SELECT id FROM "Assignment" WHERE id = ${assignmentId}::uuid FOR UPDATE`;
    const global = hasAnyPermission(actor, ['booking:operations', 'dispatch:manage']);
    const scope = global ? {} : assignmentScope(actor);
    const assignment = await tx.assignment.findFirst({ where: { AND: [{ id: assignmentId }, scope] }, select: { id: true, bookingId: true, companyId: true, teamId: true, status: true, startsAt: true, endsAt: true, expiresAt: true, acceptedAt: true } });
    if (!assignment) throw new NotFoundException();
    return assignment;
  }

  private interval(startsAtValue: string, endsAtValue: string, expiresAtValue?: string) {
    const startsAt = new Date(startsAtValue), endsAt = new Date(endsAtValue), expiresAt = expiresAtValue ? new Date(expiresAtValue) : undefined;
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt || (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()))) throw new BadRequestException({ code: 'BOOKING_INTERVAL_INVALID' });
    return { startsAt, endsAt, ...(expiresAt ? { expiresAt } : {}) };
  }

  private decimal(value: string, code: string) {
    try {
      const result = new Prisma.Decimal(value);
      if (!result.isFinite() || result.isNegative()) throw new Error();
      return result;
    } catch { throw new BadRequestException({ code }); }
  }

  private async auditBooking(tx: Transaction, actor: DispatchActor, requestId: string, action: string, resourceType: string, resourceId: string, after: object, before?: object) {
    if (actor.userId !== null) return audit(tx, { actor, requestId }, action, resourceType, resourceId, after, before);
    await tx.auditLog.create({ data: { actorUserId: null, requestId, action, resourceType, resourceId,
      after: jsonValue(after), ...(before ? { before: jsonValue(before) } : {}) } });
  }

  private async recordTransition(tx: Transaction, actor: DispatchActor, requestId: string, booking: { id: string; status: BookingStatus; version: number }, next: BookingStatus, action: string, reason?: string, metadata?: object) {
    assertBookingTransition(booking.status, next);
    const updated = await tx.booking.update({ where: { id: booking.id }, data: { status: next, version: { increment: 1 } }, select: bookingListSelect });
    await tx.bookingStatusHistory.create({ data: { bookingId: booking.id, previousStatus: booking.status, newStatus: next,
      changedByUserId: actor.userId, ...(actor.userId === null ? {} : { changedByRole: primaryRole(actor, 'booking:own') ?? primaryRole(actor, 'booking:operations') }),
      ...(reason ? { reason } : {}), ...(metadata ? { metadata: jsonValue(metadata) } : {}) } });
    await this.auditBooking(tx, actor, requestId, action, 'Booking', booking.id, { status: next, version: booking.version + 1 }, { status: booking.status, version: booking.version });
    await tx.outboxEvent.create({ data: { type: 'BOOKING_STATUS_CHANGED', aggregateId: booking.id, payload: jsonValue({ bookingId: booking.id, previousStatus: booking.status, newStatus: next, action, reason: reason ?? null }) } });
    return updated;
  }

  async confirm(actor: Actor, id: string, key: string | undefined) {
    return this.idempotent(actor, key, 'BOOKING_CONFIRM', { id }, async tx => {
      const booking = await this.locked(actor, id, false, tx);
      assertBookingTransition(booking.status, 'PRICE_CONFIRMED');
      return this.recordTransition(tx, actor, `booking-confirm:${key}`, booking, 'PRICE_CONFIRMED', 'BOOKING_PRICE_CONFIRMED', undefined, { command: 'ConfirmBooking' });
    });
  }

  async selectCash(actor: Actor, id: string, key: string | undefined) {
    return this.idempotent(actor, key, 'BOOKING_SELECT_CASH', { id }, async tx => {
      const booking = await this.locked(actor, id, false, tx);
      assertBookingTransition(booking.status, 'CASH_SELECTED');
      await tx.payment.create({ data: { bookingId: booking.id, method: 'CASH', status: 'CASH_SELECTED', amount: booking.price, currency: booking.currency } });
      await tx.booking.update({ where: { id: booking.id }, data: { paymentMethod: 'CASH' } });
      return this.recordTransition(tx, actor, `booking-cash:${key}`, booking, 'CASH_SELECTED', 'BOOKING_CASH_SELECTED', undefined, { command: 'SelectCashPayment' });
    });
  }

  /**
   * Operational confirmation of an existing server-owned snapshot. Pricing
   * quote consumption occurs at creation; customers never submit price totals.
   */
  async confirmQuote(actor: Actor, id: string, dto: QuoteConfirmationDto, key: string | undefined) {
    this.requirePermission(actor, ['pricing:manage', 'booking:operations']);
    return this.idempotent(actor, key, 'BOOKING_QUOTE_CONFIRM', { id, ...dto }, async tx => {
      const booking = await this.locked(actor, id, true, tx);
      const basePrice = this.decimal(dto.basePrice, 'QUOTE_AMOUNT_INVALID');
      const extrasTotal = this.decimal(dto.extrasTotal, 'QUOTE_AMOUNT_INVALID');
      const adjustments = new Prisma.Decimal(dto.adjustments);
      const fees = this.decimal(dto.fees, 'QUOTE_AMOUNT_INVALID');
      const discount = this.decimal(dto.discount, 'QUOTE_AMOUNT_INVALID');
      const total = this.decimal(dto.total, 'QUOTE_AMOUNT_INVALID');
      if (!basePrice.add(extrasTotal).add(adjustments).add(fees).sub(discount).eq(total)) throw new BadRequestException({ code: 'QUOTE_TOTAL_MISMATCH' });
      if (dto.currency !== booking.currency) throw new BadRequestException({ code: 'QUOTE_CURRENCY_MISMATCH' });
      const snapshot = await tx.bookingPriceSnapshot.findUniqueOrThrow({ where: { bookingId: id }, select: { pricingVersion: true, basePrice: true, extrasTotal: true, adjustments: true, fees: true, discount: true, total: true, currency: true, breakdown: true } });
      if (snapshot.pricingVersion !== dto.pricingVersion || !snapshot.basePrice.eq(basePrice) || !snapshot.extrasTotal.eq(extrasTotal) || !snapshot.adjustments.eq(adjustments) || !snapshot.fees.eq(fees) || !snapshot.discount.eq(discount) || !snapshot.total.eq(total) || snapshot.currency !== dto.currency || requestHash(snapshot.breakdown) !== requestHash(dto.breakdown)) throw new ConflictException({ code: 'QUOTE_SNAPSHOT_MISMATCH', message: 'The handoff must match the server-owned quote snapshot.' });
      assertBookingTransition(booking.status, 'PRICE_CONFIRMED');
      return this.recordTransition(tx, actor, `booking-quote:${key}`, booking, 'PRICE_CONFIRMED', 'BOOKING_QUOTE_CONFIRMED', undefined, { command: 'ConfirmQuote', pricingVersion: dto.pricingVersion, breakdown: dto.breakdown });
    });
  }

  async initiateOnlinePayment(actor: Actor, id: string, key: string | undefined) {
    return this.idempotent(actor, key, 'BOOKING_ONLINE_PAYMENT_INITIATE', { id }, async tx => {
      const booking = await this.locked(actor, id, false, tx);
      assertBookingTransition(booking.status, 'PAYMENT_PENDING');
      await tx.payment.create({ data: { bookingId: id, method: 'ONLINE', status: 'PENDING', amount: booking.price, currency: booking.currency } });
      await tx.booking.update({ where: { id }, data: { paymentMethod: 'ONLINE' } });
      return this.recordTransition(tx, actor, `booking-payment-initiate:${key}`, booking, 'PAYMENT_PENDING', 'BOOKING_ONLINE_PAYMENT_INITIATED', undefined, { command: 'InitiateOnlinePayment' });
    });
  }

  /** Trusted payment-provider confirmation boundary; gateway integration is deliberately out of scope. */
  async confirmPayment(actor: Actor, id: string, dto: PaymentConfirmationDto, key: string | undefined) {
    this.requirePermission(actor, ['payment:manage', 'booking:operations']);
    return this.idempotent(actor, key, 'BOOKING_PAYMENT_CONFIRM', { id, ...dto }, async tx => {
      const booking = await this.locked(actor, id, true, tx);
      assertBookingTransition(booking.status, 'PAYMENT_CONFIRMED');
      const payment = await this.lockedPayment(tx, id);
      if (!payment || payment.method !== 'ONLINE' || payment.status !== 'PENDING' || !payment.amount.eq(booking.price)) throw new ConflictException({ code: 'PAYMENT_NOT_CONFIRMABLE' });
      await tx.paymentEvent.create({ data: { paymentId: payment.id, provider: dto.provider, eventId: dto.eventId, type: 'PAYMENT_CONFIRMED', payloadHash: dto.payloadHash } });
      await tx.paymentTransaction.create({ data: { paymentId: payment.id, type: 'CAPTURE', amount: payment.amount, reference: dto.transactionReference } });
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'CONFIRMED', provider: dto.provider, transactionReference: dto.transactionReference } });
      return this.recordTransition(tx, actor, `booking-payment-confirm:${key}`, booking, 'PAYMENT_CONFIRMED', 'BOOKING_PAYMENT_CONFIRMED', undefined, { command: 'ConfirmPayment', provider: dto.provider, eventId: dto.eventId });
    });
  }

  /** Explicit cash authorization boundary; collection and reconciliation remain separate commands. */
  async confirmCashPayment(actor: Actor, id: string, dto: PaymentConfirmationDto, key: string | undefined) {
    this.requirePermission(actor, ['payment:manage', 'booking:operations']);
    return this.idempotent(actor, key, 'BOOKING_CASH_PAYMENT_CONFIRM', { id, ...dto }, async tx => {
      const booking = await this.locked(actor, id, true, tx);
      assertBookingTransition(booking.status, 'PAYMENT_CONFIRMED');
      const payment = await this.lockedPayment(tx, id);
      if (!payment || payment.method !== 'CASH' || payment.status !== 'CASH_SELECTED') throw new ConflictException({ code: 'CASH_PAYMENT_NOT_CONFIRMABLE' });
      await tx.paymentEvent.create({ data: { paymentId: payment.id, provider: dto.provider, eventId: dto.eventId, type: 'CASH_PAYMENT_CONFIRMED', payloadHash: dto.payloadHash } });
      await tx.paymentTransaction.create({ data: { paymentId: payment.id, type: 'CASH_AUTHORIZATION', amount: payment.amount, reference: dto.transactionReference } });
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'CONFIRMED', provider: dto.provider, transactionReference: dto.transactionReference } });
      return this.recordTransition(tx, actor, `booking-cash-confirm:${key}`, booking, 'PAYMENT_CONFIRMED', 'BOOKING_CASH_PAYMENT_CONFIRMED', undefined, { command: 'ConfirmCashPayment', eventId: dto.eventId });
    });
  }

  private async createOffer(tx: Transaction, actor: DispatchActor, booking: DispatchBooking, dto: AssignmentDto, key: string, candidates: unknown[], command: string) {
    const auditKey = requestHash(key).slice(0, 32);
    const interval = this.interval(dto.startsAt, dto.endsAt, dto.expiresAt);
    if (interval.startsAt.getTime() !== booking.scheduledAt.getTime() || interval.endsAt.getTime() !== booking.estimatedEndAt.getTime()) throw new ConflictException({ code: 'ASSIGNMENT_SLOT_MISMATCH' });
    if (await tx.assignment.count({ where: { bookingId: booking.id, status: { in: ['OFFERED', 'ACCEPTED'] } } })) throw new ConflictException({ code: 'BOOKING_HAS_ACTIVE_ASSIGNMENT' });
    await tx.$queryRaw`SELECT id FROM "Team" WHERE id = ${dto.teamId}::uuid FOR UPDATE`;
    const team = await tx.team.findFirst({ where: { id: dto.teamId, companyId: dto.companyId, active: true, status: 'AVAILABLE', company: { status: 'ACTIVE' }, capabilities: { some: { serviceId: booking.serviceId } } }, select: { capacity: true } });
    if (!team) throw new ConflictException({ code: 'TEAM_NOT_OPERATIONAL' });
    const workload = await tx.assignment.count({ where: { teamId: dto.teamId, status: { in: ['OFFERED', 'ACCEPTED'] }, startsAt: { lt: interval.endsAt }, endsAt: { gt: interval.startsAt } } });
    if (team.capacity < 1 || workload >= team.capacity) throw new ConflictException({ code: 'TEAM_CAPACITY_EXHAUSTED' });
    const lastAttempt = await tx.dispatchAttempt.findFirst({ where: { bookingId: booking.id }, orderBy: { sequence: 'desc' }, select: { sequence: true } });
    const assignment = await tx.assignment.create({ data: { bookingId: booking.id, companyId: dto.companyId, teamId: dto.teamId, startsAt: interval.startsAt, endsAt: interval.endsAt, expiresAt: interval.expiresAt!, reason: dto.reason, events: { create: { type: 'OFFERED', metadata: jsonValue({ command, reason: dto.reason }) } } }, select: { id: true, bookingId: true, companyId: true, teamId: true, status: true } });
    await tx.dispatchAttempt.create({ data: { bookingId: booking.id, sequence: (lastAttempt?.sequence ?? 0) + 1, outcome: 'ASSIGNMENT_OFFERED', candidates: jsonValue(candidates), reason: dto.reason } });
    await this.recordTransition(tx, actor, `booking-assigned:${auditKey}`, booking, 'TEAM_ASSIGNED', 'BOOKING_TEAM_ASSIGNED', dto.reason, { command, assignmentId: assignment.id, reason: dto.reason });
    await this.auditBooking(tx, actor, `booking-assign:${auditKey}`, 'BOOKING_ASSIGNMENT_OFFERED', 'Assignment', assignment.id, { ...assignment, command, reason: dto.reason, candidates });
    await tx.outboxEvent.create({ data: { type: 'ASSIGNMENT_OFFERED', aggregateId: assignment.id,
      payload: jsonValue({ bookingId: booking.id, companyId: dto.companyId, teamId: dto.teamId, expiresAt: interval.expiresAt }) } });
    return tx.booking.findUniqueOrThrow({ where: { id: booking.id }, select: bookingSelect });
  }

  /** Transactional Dispatch handoff: booking lock, candidate policy, offer/history/audit and idempotency commit together. */
  async dispatchOffer(actor: DispatchActor, id: string, key: string | undefined,
    select: (tx: Transaction, booking: DispatchBooking) => Promise<DispatchSelection>, manual = false, payload: unknown = {}) {
    if (actor.userId !== null) this.requirePermission(actor, ['dispatch:manage']);
    const work = async (tx: Transaction) => {
      const auditKey = requestHash(key).slice(0, 32);
      const observed = manual ? await tx.booking.findUnique({ where: { id }, select: { version: true } }) : null;
      let booking = await this.locked(actor, id, true, tx);
      if (observed && observed.version !== booking.version) throw new ConflictException({ code: 'BOOKING_CONCURRENT_MODIFICATION' });
      if (booking.status === 'NO_TEAM_AVAILABLE') throw new ConflictException({ code: 'DISPATCH_TERMINAL_NO_TEAM_AVAILABLE' });
      if (['TEAM_ACCEPTED', 'TEAM_ON_THE_WAY', 'CLEANING_STARTED'].includes(booking.status)) throw new ConflictException({ code: 'DISPATCH_ACCEPTED_JOB_REASSIGNMENT_UNSUPPORTED' });
      if (booking.status === 'TEAM_ASSIGNED') {
        const active = await tx.assignment.findFirst({ where: { bookingId: id, status: 'OFFERED' }, orderBy: { assignedAt: 'desc' } });
        if (!active || (!manual && active.expiresAt > new Date())) throw new ConflictException({ code: 'ASSIGNMENT_STILL_ACTIVE' });
        const reason = manual ? (payload as { reason: string }).reason : 'Offer timed out';
        await tx.assignment.update({ where: { id: active.id }, data: { status: manual ? 'CANCELLED' : 'EXPIRED', reason } });
        await tx.assignmentEvent.create({ data: { assignmentId: active.id, type: manual ? 'MANUAL_REASSIGNED' : 'EXPIRED', metadata: jsonValue({ command: manual ? 'ManualReassignBooking' : 'ExpireAssignment', reason }) } });
        if (manual) await this.auditBooking(tx, actor, `dispatch-manual-reassign:${auditKey}`, 'BOOKING_MANUAL_REASSIGNED', 'Assignment', active.id,
          { status: 'CANCELLED', reason }, { status: 'OFFERED' });
        await this.recordTransition(tx, actor, `dispatch-end-offer:${auditKey}`, booking, 'REJECTED', manual ? 'BOOKING_MANUAL_REASSIGN' : 'BOOKING_OFFER_EXPIRED', manual ? reason : undefined, { assignmentId: active.id, reason });
        booking = { ...booking, status: 'REJECTED', version: booking.version + 1 };
      }
      if (booking.status === 'PAYMENT_CONFIRMED' || booking.status === 'REJECTED' || booking.status === 'TEAM_NO_SHOW') {
        await this.recordTransition(tx, actor, `dispatch-search:${auditKey}`, booking, 'SEARCHING_FOR_TEAM', 'BOOKING_SEARCH_STARTED', undefined, { command: manual ? 'ManualReassignBooking' : 'DispatchBooking' });
        booking = { ...booking, status: 'SEARCHING_FOR_TEAM', version: booking.version + 1 };
      }
      if (booking.status !== 'SEARCHING_FOR_TEAM') throw new ConflictException({ code: 'BOOKING_NOT_ASSIGNABLE' });
      const selection = await select(tx, booking);
      if (!selection.dto) {
        const lastAttempt = await tx.dispatchAttempt.findFirst({ where: { bookingId: id }, orderBy: { sequence: 'desc' }, select: { sequence: true } });
        await tx.dispatchAttempt.create({ data: { bookingId: id, sequence: (lastAttempt?.sequence ?? 0) + 1, outcome: 'NO_TEAM_AVAILABLE', candidates: jsonValue(selection.candidates), reason: selection.reason ?? 'No eligible candidate or retry limit reached' } });
        await this.auditBooking(tx, actor, `dispatch-unassigned:${auditKey}`, 'DISPATCH_NO_TEAM_AVAILABLE', 'Booking', id, { candidates: selection.candidates, reason: selection.reason });
        await tx.outboxEvent.create({ data: { type: 'DISPATCH_NO_TEAM_AVAILABLE', aggregateId: id,
          payload: jsonValue({ bookingId: id, reason: selection.reason }) } });
        await this.recordTransition(tx, actor, `dispatch-unassigned:${auditKey}`, booking, 'NO_TEAM_AVAILABLE', 'BOOKING_NO_TEAM_AVAILABLE', undefined, { command: 'DispatchBooking' });
        return tx.booking.findUniqueOrThrow({ where: { id }, select: bookingSelect });
      }
      return this.createOffer(tx, actor, booking, selection.dto, key!, selection.candidates, manual ? 'ManualReassignBooking' : 'DispatchBooking');
    };
    return actor.userId === null ? this.db.$transaction(work) :
      this.idempotent(actor, key, manual ? 'DISPATCH_MANUAL' : 'DISPATCH_AUTO', { id, manual, payload }, work);
  }

  /** Internal worker path: no human grant or IdempotencyKey row; booking/team locks make a rerun converge. */
  async dispatchSystem(id: string, select: (tx: Transaction, booking: DispatchBooking) => Promise<DispatchSelection>) {
    const actor: DispatchActor = { userId: null, sessionId: 'system', familyId: 'system',
      scopes: [{ role: 'DISPATCHER', companyId: null, teamId: null, permissions: ['dispatch:manage', 'booking:operations'] }] };
    return this.dispatchOffer(actor, id, `system-${randomUUID()}`, select);
  }

  async markNoTeamAvailable(actor: Actor, id: string, key: string | undefined) {
    this.requirePermission(actor, ['dispatch:manage', 'booking:operations']);
    return this.idempotent(actor, key, 'BOOKING_NO_TEAM', { id }, async tx => {
      const booking = await this.locked(actor, id, true, tx);
      return this.recordTransition(tx, actor, `booking-no-team:${key}`, booking, 'NO_TEAM_AVAILABLE', 'BOOKING_NO_TEAM_AVAILABLE', undefined, { command: 'MarkNoTeamAvailable' });
    });
  }

  private async assignmentBooking(actor: Actor, assignmentId: string, tx: Transaction) {
    const global = hasAnyPermission(actor, ['booking:operations', 'dispatch:manage']);
    const scope = global ? {} : assignmentScope(actor);
    const candidate = await tx.assignment.findFirst({ where: { AND: [{ id: assignmentId }, scope] }, select: { bookingId: true } });
    if (!candidate) throw new NotFoundException();
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${candidate.bookingId}::uuid FOR UPDATE`;
    const booking = await tx.booking.findUnique({ where: { id: candidate.bookingId }, select: { id: true, customerId: true, serviceId: true, status: true, version: true, price: true, paymentMethod: true, bookingNumber: true, scheduledAt: true, estimatedEndAt: true } });
    if (!booking) throw new NotFoundException();
    const assignment = await this.lockedAssignment(actor, assignmentId, tx);
    return { booking, assignment };
  }

  async acceptAssignment(actor: Actor, assignmentId: string, key: string | undefined) {
    this.requirePermission(actor, ['assignment:team', 'assignment:company', 'booking:operations']);
    return this.idempotent(actor, key, 'BOOKING_ASSIGNMENT_ACCEPT', { assignmentId }, async tx => {
      const { booking, assignment } = await this.assignmentBooking(actor, assignmentId, tx);
      if (assignment.status !== 'OFFERED') throw new ConflictException({ code: 'ASSIGNMENT_NOT_ACCEPTABLE' });
      if (assignment.expiresAt <= new Date()) throw new ConflictException({ code: 'ASSIGNMENT_EXPIRED' });
      await tx.$queryRaw`SELECT id FROM "Team" WHERE id = ${assignment.teamId}::uuid FOR UPDATE`;
      const team = await tx.team.findUnique({ where: { id: assignment.teamId }, select: { active: true, status: true, company: { select: { status: true } } } });
      if (!team?.active || team.status !== 'AVAILABLE' || team.company.status !== 'ACTIVE') throw new ConflictException({ code: 'TEAM_NOT_OPERATIONAL' });
      if (!await tx.teamServiceCapability.findFirst({ where: { teamId: assignment.teamId, serviceId: booking.serviceId }, select: { teamId: true } }))
        throw new ConflictException({ code: 'TEAM_CAPABILITY_MISMATCH' });
      const updated = await tx.assignment.update({ where: { id: assignmentId }, data: { status: 'ACCEPTED', acceptedAt: new Date() }, select: { id: true, status: true, acceptedAt: true } });
      await tx.assignmentEvent.create({ data: { assignmentId, type: 'ACCEPTED', metadata: jsonValue({ command: 'AcceptAssignment' }) } });
      await this.recordTransition(tx, actor, `booking-assignment-accept:${key}`, booking, 'TEAM_ACCEPTED', 'BOOKING_TEAM_ACCEPTED', undefined, { command: 'AcceptAssignment', assignmentId });
      return updated;
    });
  }

  async rejectAssignment(actor: Actor, assignmentId: string, reason: string | undefined, key: string | undefined) {
    this.requirePermission(actor, ['assignment:team', 'assignment:company', 'booking:operations']);
    return this.idempotent(actor, key, 'BOOKING_ASSIGNMENT_REJECT', { assignmentId, reason }, async tx => {
      const { booking, assignment } = await this.assignmentBooking(actor, assignmentId, tx);
      if (assignment.status !== 'OFFERED') throw new ConflictException({ code: 'ASSIGNMENT_NOT_REJECTABLE' });
      if (assignment.expiresAt <= new Date()) throw new ConflictException({ code: 'ASSIGNMENT_EXPIRED' });
      const updated = await tx.assignment.update({ where: { id: assignmentId }, data: { status: 'REJECTED', reason }, select: { id: true, status: true, reason: true } });
      await tx.assignmentEvent.create({ data: { assignmentId, type: 'REJECTED', metadata: jsonValue({ command: 'RejectAssignment', reason }) } });
      await this.recordTransition(tx, actor, `booking-assignment-reject:${key}`, booking, 'REJECTED', 'BOOKING_TEAM_REJECTED', reason, { command: 'RejectAssignment', assignmentId });
      return updated;
    });
  }

  async retryAssignment(actor: Actor, id: string, key: string | undefined) {
    this.requirePermission(actor, ['dispatch:manage', 'booking:operations']);
    return this.idempotent(actor, key, 'BOOKING_ASSIGNMENT_RETRY', { id }, async tx => {
      const booking = await this.locked(actor, id, true, tx);
      return this.recordTransition(tx, actor, `booking-assignment-retry:${key}`, booking, 'SEARCHING_FOR_TEAM', 'BOOKING_ASSIGNMENT_RETRY', undefined, { command: 'RetryAssignment' });
    });
  }

  private async jobTransition(actor: Actor, assignmentId: string, next: BookingStatus, action: string, command: string, key: string | undefined, revalidateTeam = false) {
    this.requirePermission(actor, ['job:team', 'assignment:team', 'assignment:company', 'booking:operations']);
    return this.idempotent(actor, key, `BOOKING_JOB_${command.toUpperCase()}`, { assignmentId }, async tx => {
      const { booking, assignment } = await this.assignmentBooking(actor, assignmentId, tx);
      if (assignment.status !== 'ACCEPTED') throw new ConflictException({ code: 'ASSIGNMENT_NOT_ACTIVE' });
      if (revalidateTeam) {
        await tx.$queryRaw`SELECT id FROM "Team" WHERE id = ${assignment.teamId}::uuid FOR UPDATE`;
        const team = await tx.team.findUnique({ where: { id: assignment.teamId }, select: { active: true, status: true, company: { select: { status: true } } } });
        if (!team?.active || team.status === 'OFFLINE' || team.status === 'PAUSED' || team.company.status !== 'ACTIVE')
          throw new ConflictException({ code: 'TEAM_NOT_OPERATIONAL' });
        if (!await tx.teamServiceCapability.findFirst({ where: { teamId: assignment.teamId, serviceId: booking.serviceId }, select: { teamId: true } }))
          throw new ConflictException({ code: 'TEAM_CAPABILITY_MISMATCH' });
      }
      const updated = await this.recordTransition(tx, actor, `booking-job:${key}`, booking, next, action, undefined, { command, assignmentId });
      await tx.assignmentEvent.create({ data: { assignmentId, type: command.toUpperCase(), metadata: jsonValue({ command }) } });
      return updated;
    });
  }

  async markOnTheWay(actor: Actor, assignmentId: string, key: string | undefined) { return this.jobTransition(actor, assignmentId, 'TEAM_ON_THE_WAY', 'BOOKING_TEAM_ON_THE_WAY', 'MarkOnTheWay', key); }
  async startCleaning(actor: Actor, assignmentId: string, key: string | undefined) { return this.jobTransition(actor, assignmentId, 'CLEANING_STARTED', 'BOOKING_CLEANING_STARTED', 'StartCleaning', key, true); }

  async completeCleaning(actor: Actor, assignmentId: string, key: string | undefined) {
    this.requirePermission(actor, ['job:team', 'assignment:team', 'assignment:company', 'booking:operations']);
    return this.idempotent(actor, key, 'BOOKING_CLEANING_COMPLETE', { assignmentId }, async tx => {
      const { booking, assignment } = await this.assignmentBooking(actor, assignmentId, tx);
      if (assignment.status !== 'ACCEPTED') throw new ConflictException({ code: 'ASSIGNMENT_NOT_ACTIVE' });
      const updatedAssignment = await tx.assignment.update({ where: { id: assignmentId }, data: { status: 'COMPLETED' }, select: { id: true, status: true } });
      await tx.assignmentEvent.create({ data: { assignmentId, type: 'COMPLETED', metadata: jsonValue({ command: 'CompleteCleaning' }) } });
      await this.recordTransition(tx, actor, `booking-cleaning-complete:${key}`, booking, 'CLEANING_COMPLETED', 'BOOKING_CLEANING_COMPLETED', undefined, { command: 'CompleteCleaning', assignmentId });
      return updatedAssignment;
    });
  }

  async submitCompletionProof(actor: Actor, assignmentId: string, dto: CompletionProofDto, key: string | undefined) {
    this.requirePermission(actor, ['job:team', 'assignment:team', 'assignment:company', 'booking:operations']);
    return this.idempotent(actor, key, 'BOOKING_COMPLETION_PROOF', { assignmentId, ...dto }, async tx => {
      const { booking, assignment } = await this.assignmentBooking(actor, assignmentId, tx);
      if (!['CLEANING_COMPLETED', 'PAYMENT_RECONCILIATION', 'COMPLETED'].includes(booking.status) || assignment.status !== 'COMPLETED') throw new ConflictException({ code: 'COMPLETION_PROOF_NOT_ALLOWED' });
      const proof = await tx.completionProof.create({ data: { assignmentId, storageKey: dto.storageKey, mimeType: dto.mimeType, byteSize: dto.byteSize }, select: { id: true, assignmentId: true, storageKey: true, mimeType: true, byteSize: true, createdAt: true } });
      await audit(tx, { actor, requestId: `booking-proof:${key}` }, 'BOOKING_COMPLETION_PROOF_SUBMITTED', 'CompletionProof', proof.id, { ...proof, bookingId: booking.id });
      return proof;
    });
  }

  private async noShow(actor: Actor, assignmentId: string, next: 'TEAM_NO_SHOW' | 'CUSTOMER_NO_SHOW', action: string, command: string, key: string | undefined) {
    this.requirePermission(actor, ['job:team', 'assignment:team', 'assignment:company', 'booking:operations']);
    return this.idempotent(actor, key, `BOOKING_${command.toUpperCase()}`, { assignmentId }, async tx => {
      const { booking, assignment } = await this.assignmentBooking(actor, assignmentId, tx);
      const expected = next === 'TEAM_NO_SHOW' ? 'TEAM_ON_THE_WAY' : 'CLEANING_STARTED';
      if (booking.status !== expected || assignment.status !== 'ACCEPTED') throw new ConflictException({ code: 'NO_SHOW_NOT_ALLOWED' });
      await tx.assignment.update({ where: { id: assignmentId }, data: { status: 'CANCELLED' } });
      await tx.assignmentEvent.create({ data: { assignmentId, type: command.toUpperCase(), metadata: jsonValue({ command }) } });
      return this.recordTransition(tx, actor, `booking-no-show:${key}`, booking, next, action, undefined, { command, assignmentId });
    });
  }

  async markTeamNoShow(actor: Actor, assignmentId: string, key: string | undefined) { return this.noShow(actor, assignmentId, 'TEAM_NO_SHOW', 'BOOKING_TEAM_NO_SHOW', 'MarkTeamNoShow', key); }
  async markCustomerNoShow(actor: Actor, assignmentId: string, key: string | undefined) { return this.noShow(actor, assignmentId, 'CUSTOMER_NO_SHOW', 'BOOKING_CUSTOMER_NO_SHOW', 'MarkCustomerNoShow', key); }

  async beginPaymentReconciliation(actor: Actor, id: string, key: string | undefined) {
    this.requirePermission(actor, ['payment:manage', 'booking:operations']);
    return this.idempotent(actor, key, 'BOOKING_PAYMENT_RECONCILIATION_BEGIN', { id }, async tx => {
      const booking = await this.locked(actor, id, true, tx);
      const assignment = await tx.assignment.findFirst({ where: { bookingId: id, status: 'COMPLETED' }, select: { id: true } });
      if (!assignment) throw new ConflictException({ code: 'COMPLETED_ASSIGNMENT_REQUIRED' });
      return this.recordTransition(tx, actor, `booking-reconciliation-begin:${key}`, booking, 'PAYMENT_RECONCILIATION', 'BOOKING_PAYMENT_RECONCILIATION_STARTED', undefined, { command: 'BeginPaymentReconciliation' });
    });
  }

  async collectCash(actor: Actor, assignmentId: string, dto: CashCollectionDto, key: string | undefined) {
    this.requirePermission(actor, ['cash:team', 'payment:manage', 'booking:operations']);
    return this.idempotent(actor, key, 'BOOKING_CASH_COLLECT', { assignmentId, ...dto }, async tx => {
      const { booking, assignment } = await this.assignmentBooking(actor, assignmentId, tx);
      if (!['CLEANING_COMPLETED', 'PAYMENT_RECONCILIATION'].includes(booking.status) || assignment.status !== 'COMPLETED') throw new ConflictException({ code: 'CASH_COLLECTION_NOT_ALLOWED' });
      const payment = await this.lockedPayment(tx, booking.id);
      const amount = this.decimal(dto.amount, 'CASH_AMOUNT_INVALID');
      if (!payment || payment.method !== 'CASH' || !payment.amount.eq(amount) || !['CONFIRMED', 'CASH_SELECTED'].includes(payment.status)) throw new ConflictException({ code: 'CASH_PAYMENT_NOT_COLLECTABLE' });
      const collection = await tx.cashCollection.create({ data: { paymentId: payment.id, collectedByUserId: actor.userId, collectorCompanyId: assignment.companyId, collectorTeamId: assignment.teamId, amount }, select: { id: true, paymentId: true, amount: true, collectedByUserId: true, collectorCompanyId: true, collectorTeamId: true, collectedAt: true } });
      await tx.paymentTransaction.create({ data: { paymentId: payment.id, type: 'CASH_COLLECTION', amount, reference: `cash-collection:${payment.id}:${key}` } });
      await tx.paymentStatusHistory.create({ data: { paymentId: payment.id, previousStatus: payment.status, newStatus: 'CASH_COLLECTED', reason: 'CASH_COLLECTED', changedByUserId: actor.userId } });
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'CASH_COLLECTED' } });
      await tx.outboxEvent.create({ data: { type: 'CASH_COLLECTED', aggregateId: collection.id, payload: jsonValue({ bookingId: booking.id, paymentId: payment.id, collectionId: collection.id }) } });
      await audit(tx, { actor, requestId: `booking-cash-collect:${key}` }, 'CASH_COLLECTED', 'CashCollection', collection.id, { paymentId: payment.id, bookingId: booking.id, amount: amount.toString(), companyId: assignment.companyId, teamId: assignment.teamId });
      if (booking.status === 'CLEANING_COMPLETED') await this.recordTransition(tx, actor, `booking-cash-reconcile:${key}`, booking, 'PAYMENT_RECONCILIATION', 'BOOKING_PAYMENT_RECONCILIATION_STARTED', undefined, { command: 'CollectCash' });
      return collection;
    });
  }

  async reconcilePayment(actor: Actor, id: string, key: string | undefined) {
    this.requirePermission(actor, ['payment:manage', 'booking:operations']);
    return this.idempotent(actor, key, 'BOOKING_PAYMENT_RECONCILE', { id }, async tx => {
      const booking = await this.locked(actor, id, true, tx);
      if (booking.status !== 'PAYMENT_RECONCILIATION') throw new ConflictException({ code: 'PAYMENT_RECONCILIATION_NOT_ALLOWED' });
      const payment = await this.lockedPayment(tx, id);
      if (!payment || !['CONFIRMED', 'CASH_COLLECTED'].includes(payment.status)) throw new ConflictException({ code: 'PAYMENT_NOT_RECONCILABLE' });
      if (payment.method === 'CASH' && !payment.cashCollection) throw new ConflictException({ code: 'CASH_COLLECTION_REQUIRED' });
      await tx.paymentStatusHistory.create({ data: { paymentId: payment.id, previousStatus: payment.status, newStatus: 'RECONCILED', reason: 'PAYMENT_RECONCILED', changedByUserId: actor.userId } });
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'RECONCILED', cashCollection: payment.cashCollection ? { update: { reconciledAt: new Date() } } : undefined } });
      await audit(tx, { actor, requestId: `booking-payment-reconcile:${key}` }, 'BOOKING_PAYMENT_RECONCILED', 'Payment', payment.id, { bookingId: id, status: 'RECONCILED' }, { status: payment.status });
      return tx.booking.findUniqueOrThrow({ where: { id }, select: bookingSelect });
    });
  }

  async complete(actor: Actor, id: string, key: string | undefined) {
    this.requirePermission(actor, ['payment:manage', 'booking:operations']);
    return this.idempotent(actor, key, 'BOOKING_COMPLETE', { id }, async tx => {
      const booking = await this.locked(actor, id, true, tx);
      const payment = await this.lockedPayment(tx, id);
      if (!payment || payment.status !== 'RECONCILED') throw new ConflictException({ code: 'PAYMENT_NOT_RECONCILED' });
      return this.recordTransition(tx, actor, `booking-complete:${key}`, booking, 'COMPLETED', 'BOOKING_COMPLETED', undefined, { command: 'CompleteBooking' });
    });
  }

  async requestRefund(actor: Actor, id: string, dto: RefundDto, key: string | undefined) {
    this.requirePermission(actor, ['refund:manage', 'payment:manage', 'booking:operations']);
    return this.idempotent(actor, key, 'BOOKING_REFUND_REQUEST', { id, ...dto }, async tx => {
      const booking = await this.locked(actor, id, true, tx);
      if (booking.status !== 'PAYMENT_RECONCILIATION') throw new ConflictException({ code: 'REFUND_NOT_ALLOWED' });
      const payment = await this.lockedPayment(tx, id);
      const amount = this.decimal(dto.amount, 'REFUND_AMOUNT_INVALID');
      const successful = payment?.refunds.filter(refund => refund.status === 'SUCCEEDED').reduce((sum, refund) => sum.add(refund.amount), new Prisma.Decimal(0)) ?? new Prisma.Decimal(0);
      const pending = payment?.refunds.filter(refund => refund.status === 'PENDING').reduce((sum, refund) => sum.add(refund.amount), new Prisma.Decimal(0)) ?? new Prisma.Decimal(0);
      if (!payment || payment.status !== 'RECONCILED' || !amount.gt(0) || amount.gt(payment.amount.sub(successful).sub(pending))) throw new ConflictException({ code: 'REFUND_OVER_LIMIT' });
      const refund = await tx.refund.create({ data: { paymentId: payment.id, amount, reason: dto.reason }, select: { id: true, paymentId: true, amount: true, status: true, reason: true } });
      await tx.refundHistory.create({ data: { refundId: refund.id, previousStatus: null, newStatus: 'PENDING', reason: dto.reason } });
      await this.recordTransition(tx, actor, `booking-refund-request:${key}`, booking, 'REFUND_PENDING', 'BOOKING_REFUND_REQUESTED', dto.reason, { command: 'CreateRefund', refundId: refund.id });
      return refund;
    });
  }

  async completeRefund(actor: Actor, id: string, dto: RefundCompletionDto, key: string | undefined) {
    this.requirePermission(actor, ['refund:manage', 'payment:manage', 'booking:operations']);
    return this.idempotent(actor, key, 'BOOKING_REFUND_COMPLETE', { id, ...dto }, async tx => {
      const booking = await this.locked(actor, id, true, tx);
      if (booking.status !== 'REFUND_PENDING') throw new ConflictException({ code: 'REFUND_NOT_PENDING' });
      const payment = await this.lockedPayment(tx, id);
      const refund = payment ? await tx.refund.findFirst({ where: { paymentId: payment.id, status: 'PENDING' }, orderBy: { createdAt: 'desc' } }) : null;
      if (!payment || !refund) throw new ConflictException({ code: 'REFUND_NOT_PENDING' });
      await tx.paymentEvent.create({ data: { paymentId: payment.id, provider: dto.provider, eventId: dto.eventId, type: 'REFUND_SUCCEEDED', payloadHash: dto.payloadHash } });
      const updated = await tx.refund.update({ where: { id: refund.id }, data: { status: 'SUCCEEDED', reference: dto.reference } });
      await tx.refundHistory.create({ data: { refundId: refund.id, previousStatus: 'PENDING', newStatus: 'SUCCEEDED', provider: dto.provider, reference: dto.reference } });
      const totalRefunded = await tx.refund.aggregate({ where: { paymentId: payment.id, status: 'SUCCEEDED' }, _sum: { amount: true } });
      await tx.paymentStatusHistory.create({ data: { paymentId: payment.id, previousStatus: payment.status, newStatus: totalRefunded._sum.amount?.gte(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED', reason: 'REFUND_SUCCEEDED', changedByUserId: actor.userId, provider: dto.provider, eventId: dto.eventId } });
      await tx.payment.update({ where: { id: payment.id }, data: { status: totalRefunded._sum.amount?.gte(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
      await this.recordTransition(tx, actor, `booking-refund-complete:${key}`, booking, 'REFUNDED', 'BOOKING_REFUNDED', undefined, { command: 'CompleteRefund', refundId: refund.id, reference: dto.reference });
      return updated;
    });
  }

  async cancel(actor: Actor, id: string, dto: CancelBookingDto, key: string | undefined) {
    return this.idempotent(actor, key, 'BOOKING_CANCEL', { id, ...dto }, async tx => {
      const booking = await this.locked(actor, id, true, tx);
      return this.recordTransition(tx, actor, `booking-cancel:${key}`, booking, 'CANCELLED', 'BOOKING_CANCELLED', dto.reason, { command: 'CancelBooking' });
    });
  }
}
