import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type SettlementStatus } from '@prisma/client';
import type { Actor } from '../auth/authorization.js';
import { PrismaService } from '../database/database.module.js';
import { audit } from '../core/core.policy.js';
import type { CreateSettlementDto, SettlementCommandDto, SettlementPaymentDto } from './payment.dto.js';
import { createHash, randomUUID } from 'node:crypto';
import type { ListQueryDto } from '../core/core.dto.js';

type Tx = Prisma.TransactionClient;
type Status = SettlementStatus;
function jsonValue(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
function requestHash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function has(actor: Actor, permission: string) { return actor.scopes.some(scope => scope.permissions.includes(permission)); }
function zero() { return new Prisma.Decimal(0); }
function money(value: string) { const result = new Prisma.Decimal(value); if (!result.isFinite() || result.isNegative() || result.decimalPlaces() > 2) throw new BadRequestException({ code: 'SETTLEMENT_AMOUNT_INVALID' }); return result; }

@Injectable()
export class SettlementService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  private key(key: string | undefined) { if (!key || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' }); return key; }
  private async idempotent<T>(actor: Actor, key: string | undefined, operation: string, payload: unknown, work: (tx: Tx) => Promise<T>) {
    const idempotencyKey = this.key(key); const hash = requestHash(payload);
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${actor.userId}:${operation}:${idempotencyKey}`}))`;
      const existing = await tx.idempotencyKey.findUnique({ where: { userId_operation_key: { userId: actor.userId, operation, key: idempotencyKey } } });
      if (existing) { if (existing.requestHash !== hash) throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' }); return existing.response as T; }
      const result = await work(tx); await tx.idempotencyKey.create({ data: { userId: actor.userId, operation, key: idempotencyKey, requestHash: hash, response: jsonValue(result) } }); return result;
    });
  }
  private companyWhere(actor: Actor): Prisma.SettlementWhereInput {
    if (has(actor, 'settlement:manage')) return {};
    const ids = actor.scopes.filter(scope => scope.companyId && scope.permissions.includes('settlement:company')).map(scope => scope.companyId!);
    if (!ids.length) throw new ForbiddenException(); return { companyId: { in: ids } };
  }
  private providerCompanyWhere(actor: Actor): Prisma.SettlementWhereInput {
    const ids = actor.scopes
      .filter(scope => scope.role === 'COMPANY_MANAGER' && scope.companyId && scope.permissions.includes('settlement:company'))
      .map(scope => scope.companyId!);
    if (!ids.length) throw new ForbiddenException();
    return { companyId: { in: ids } };
  }
  async providerList(actor: Actor, page: ListQueryDto) {
    const rows = await this.db.settlement.findMany({
      where: this.providerCompanyWhere(actor),
      select: {
        id: true, companyId: true, reference: true, status: true, periodStart: true, periodEnd: true,
        total: true, currency: true, version: true, createdAt: true, updatedAt: true,
        company: { select: { id: true, name: true, status: true } },
        payments: { select: { amount: true, direction: true } },
        reconciliations: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { status: true, createdAt: true } },
        _count: { select: { items: true } },
      },
      take: page.limit, skip: page.offset, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(({ payments, reconciliations, _count, ...row }) => ({
      ...row,
      paidAmount: payments.reduce((sum, payment) => sum.add(payment.amount), zero()),
      payoutDirection: payments[0]?.direction ?? (row.total.isNegative() ? 'TO_PLATFORM' : 'TO_PROVIDER'),
      latestReconciliationStatus: reconciliations[0]?.status ?? null,
      latestReconciledAt: reconciliations[0]?.createdAt ?? null,
      workItemCount: _count.items,
    }));
  }
  async providerDetail(actor: Actor, id: string) {
    const settlement = await this.db.settlement.findFirst({
      where: { AND: [{ id }, this.providerCompanyWhere(actor)] },
      select: {
        id: true, companyId: true, reference: true, status: true, periodStart: true, periodEnd: true,
        total: true, currency: true, version: true, createdAt: true, updatedAt: true,
        company: { select: { id: true, name: true, status: true } },
        items: {
          select: {
            id: true, amount: true,
            payable: { select: { booking: { select: { id: true, bookingNumber: true, scheduledAt: true, serviceSnapshot: true } } } },
          },
          orderBy: { id: 'asc' },
        },
        payments: { select: { id: true, amount: true, direction: true, reference: true, paidAt: true, createdAt: true }, orderBy: [{ paidAt: 'asc' }, { id: 'asc' }] },
        reconciliations: { select: { runNumber: true, status: true, difference: true, createdAt: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 },
      },
    });
    if (!settlement) throw new NotFoundException();
    const { items, payments, reconciliations, ...row } = settlement;
    return {
      ...row,
      paidAmount: payments.reduce((sum, payment) => sum.add(payment.amount), zero()),
      payoutDirection: payments[0]?.direction ?? (row.total.isNegative() ? 'TO_PLATFORM' : 'TO_PROVIDER'),
      workItems: items.map(item => ({
        id: item.id,
        amount: item.amount,
        booking: {
          id: item.payable.booking.id,
          bookingNumber: item.payable.booking.bookingNumber,
          scheduledAt: item.payable.booking.scheduledAt,
          service: this.providerServiceSnapshot(item.payable.booking.serviceSnapshot),
        },
      })),
      payouts: payments,
      latestReconciliation: reconciliations[0] ?? null,
    };
  }
  private providerServiceSnapshot(snapshot: Prisma.JsonValue) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
    const value = snapshot as Record<string, Prisma.JsonValue>;
    return {
      name: typeof value.name === 'string' ? value.name : null,
      nameAr: typeof value.nameAr === 'string' ? value.nameAr : null,
    };
  }
  async list(actor: Actor) { return this.db.settlement.findMany({ where: this.companyWhere(actor), select: { id: true, companyId: true, reference: true, status: true, periodStart: true, periodEnd: true, total: true, currency: true, version: true, createdAt: true, updatedAt: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }); }
  async detail(actor: Actor, id: string) {
    // The legacy detail contains calculation/allocation/audit-grade finance fields.
    // Provider managers use the narrow /provider/settlements projection instead.
    if (!has(actor, 'settlement:manage')) throw new ForbiddenException();
    const settlement = await this.db.settlement.findFirst({ where: { AND: [{ id }, this.companyWhere(actor)] }, include: { items: { include: { payable: true, allocations: { include: { payment: true } } } }, payments: true, allocations: { include: { payment: true } }, reconciliations: { orderBy: { createdAt: 'asc' } }, history: { orderBy: { createdAt: 'asc' } } } });
    if (!settlement) throw new NotFoundException(); return settlement;
  }
  private async history(tx: Tx, settlementId: string, previousStatus: Status | null, newStatus: Status, reason: string, actorUserId: string) { await tx.settlementHistory.create({ data: { settlementId, previousStatus, newStatus, reason, changedByUserId: actorUserId } }); await tx.outboxEvent.create({ data: { type: 'SETTLEMENT_STATUS_CHANGED', aggregateId: settlementId, payload: jsonValue({ settlementId, previousStatus, newStatus, reason }) } }); }
  private async lockSettlement(tx: Tx, id: string) { await tx.$queryRaw`SELECT id FROM "Settlement" WHERE id = ${id}::uuid FOR UPDATE`; const settlement = await tx.settlement.findUnique({ where: { id } }); if (!settlement) throw new NotFoundException(); return settlement; }

  private async calculateLocked(tx: Tx, actor: Actor, settlement: { id: string; companyId: string; periodStart: Date; periodEnd: Date; status: Status }) {
    if (settlement.status !== 'DRAFT') throw new ConflictException({ code: 'SETTLEMENT_NOT_CALCULABLE' });
    const company = await tx.company.findUnique({ where: { id: settlement.companyId }, select: { id: true, commissionRate: true } }); if (!company) throw new NotFoundException();
    const bookings = await tx.booking.findMany({
      where: { status: { in: ['COMPLETED', 'REFUNDED'] }, scheduledAt: { gte: settlement.periodStart, lt: settlement.periodEnd }, assignments: { some: { companyId: company.id, status: 'COMPLETED' } }, payments: { some: { status: { in: ['RECONCILED', 'PARTIALLY_REFUNDED', 'REFUNDED'] } } }, payable: null },
      select: { id: true, price: true, currency: true, priceSnapshot: { select: { basePrice: true, extrasTotal: true, adjustments: true, fees: true, discount: true, total: true, pricingVersion: true, breakdown: true } }, payments: { where: { status: { in: ['RECONCILED', 'PARTIALLY_REFUNDED', 'REFUNDED'] } }, select: { id: true, method: true, amount: true, currency: true, status: true, cashCollection: { select: { amount: true } }, refunds: { where: { status: 'SUCCEEDED' }, select: { amount: true } } } } },
    });
    if (!bookings.length) throw new ConflictException({ code: 'SETTLEMENT_NO_ELIGIBLE_PAYABLES' });
    let total = zero();
    for (const booking of bookings) {
      if (booking.currency !== 'JOD' || booking.payments.some(payment => payment.currency !== booking.currency)) throw new ConflictException({ code: 'SETTLEMENT_CURRENCY_UNSUPPORTED' });
      const gross = booking.price;
      const refunded = booking.payments.reduce((sum, payment) => sum.add(payment.refunds.reduce((inner, refund) => inner.add(refund.amount), zero())), zero());
      if (refunded.gt(gross)) throw new ConflictException({ code: 'SETTLEMENT_REFUND_EXCEEDS_PRICE' });
      const netCustomer = gross.sub(refunded).toDecimalPlaces(2);
      const commission = netCustomer.mul(company.commissionRate).toDecimalPlaces(2);
      const provider = netCustomer.sub(commission).toDecimalPlaces(2);
      const cash = booking.payments.filter(payment => payment.method === 'CASH').reduce((sum, payment) => sum.add(payment.cashCollection?.amount ?? zero()), zero());
      const online = booking.payments.filter(payment => payment.method === 'ONLINE').reduce((sum, payment) => sum.add(payment.amount).sub(payment.refunds.reduce((inner, refund) => inner.add(refund.amount), zero())), zero());
      const netPayable = provider.sub(cash).toDecimalPlaces(2);
      const snapshot = { price: gross.toString(), priceSnapshot: booking.priceSnapshot, commissionRate: company.commissionRate.toString(), platformCommission: commission.toString(), providerAmount: provider.toString(), cashCollected: cash.toString(), onlineCollected: online.toString(), refundedAmount: refunded.toString(), netCustomerAmount: netCustomer.toString(), netPayable: netPayable.toString() };
      const payable = await tx.providerPayable.create({ data: { bookingId: booking.id, companyId: company.id, customerAmount: netCustomer, commissionRate: company.commissionRate, platformCommission: commission, providerAmount: provider, cashCollected: cash, netPayable, grossAmount: gross, refundedAmount: refunded, netCustomerAmount: netCustomer, onlineCollected: online, calculationSnapshot: jsonValue(snapshot), calculatedAt: new Date() } });
      const item = await tx.settlementItem.create({ data: { settlementId: settlement.id, payableId: payable.id, companyId: company.id, amount: netPayable } });
      for (const payment of booking.payments) {
        const paymentRefund = payment.refunds.reduce((sum, refund) => sum.add(refund.amount), zero());
        await tx.settlementPaymentAllocation.create({ data: { settlementId: settlement.id, settlementItemId: item.id, paymentId: payment.id, amount: payment.amount.sub(paymentRefund).toDecimalPlaces(2), refundedAmount: paymentRefund } });
      }
      total = total.add(netPayable);
    }
    const updated = await tx.settlement.update({ where: { id: settlement.id }, data: { total, status: 'CALCULATED', version: { increment: 1 } }, select: { id: true, companyId: true, reference: true, status: true, periodStart: true, periodEnd: true, total: true, currency: true, version: true } });
    await this.history(tx, settlement.id, 'DRAFT', 'CALCULATED', 'SETTLEMENT_CALCULATED', actor.userId);
    await audit(tx, { actor, requestId: `settlement-calculate:${settlement.id}` }, 'SETTLEMENT_CALCULATED', 'Settlement', settlement.id, { total: total.toString(), bookingCount: bookings.length, paymentCount: bookings.reduce((sum, booking) => sum + booking.payments.length, 0) });
    return updated;
  }

  async create(actor: Actor, dto: CreateSettlementDto, key: string | undefined) {
    if (!has(actor, 'settlement:manage')) throw new ForbiddenException();
    return this.idempotent(actor, key, 'SETTLEMENT_CREATE', dto, async tx => {
      const start = new Date(dto.periodStart), end = new Date(dto.periodEnd); if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new BadRequestException({ code: 'SETTLEMENT_PERIOD_INVALID' });
      await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${dto.companyId}::uuid FOR UPDATE`;
      const company = await tx.company.findUnique({ where: { id: dto.companyId }, select: { id: true } }); if (!company) throw new NotFoundException();
      const settlement = await tx.settlement.create({ data: { companyId: company.id, reference: `HC-SET-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`, status: 'DRAFT', periodStart: start, periodEnd: end, total: zero(), currency: 'JOD' } });
      const calculated = await this.calculateLocked(tx, actor, settlement); await audit(tx, { actor, requestId: `settlement-create:${key}` }, 'SETTLEMENT_CREATED', 'Settlement', settlement.id, { companyId: company.id, total: calculated.total.toString() }); return calculated;
    });
  }
  async calculate(actor: Actor, id: string, key: string | undefined) { if (!has(actor, 'settlement:manage')) throw new ForbiddenException(); return this.idempotent(actor, key, 'SETTLEMENT_CALCULATE', { id }, async tx => this.calculateLocked(tx, actor, await this.lockSettlement(tx, id))); }
  async submitReview(actor: Actor, id: string, key: string | undefined) {
    if (!has(actor, 'settlement:manage')) throw new ForbiddenException(); return this.idempotent(actor, key, 'SETTLEMENT_SUBMIT_REVIEW', { id }, async tx => { const settlement = await this.lockSettlement(tx, id); if (settlement.status !== 'CALCULATED') throw new ConflictException({ code: 'SETTLEMENT_NOT_REVIEWABLE' }); const updated = await tx.settlement.update({ where: { id }, data: { status: 'READY_FOR_REVIEW', version: { increment: 1 } }, select: { id: true, companyId: true, reference: true, status: true, total: true, currency: true, version: true } }); await this.history(tx, id, 'CALCULATED', 'READY_FOR_REVIEW', 'SETTLEMENT_READY_FOR_REVIEW', actor.userId); await audit(tx, { actor, requestId: `settlement-submit-review:${key}` }, 'SETTLEMENT_READY_FOR_REVIEW', 'Settlement', id, { status: updated.status }); return updated; });
  }
  async approve(actor: Actor, id: string, key: string | undefined) {
    if (!has(actor, 'settlement:manage')) throw new ForbiddenException(); return this.idempotent(actor, key, 'SETTLEMENT_APPROVE', { id }, async tx => { const settlement = await this.lockSettlement(tx, id); if (!['CALCULATED', 'READY_FOR_REVIEW'].includes(settlement.status)) throw new ConflictException({ code: 'SETTLEMENT_NOT_APPROVABLE' }); const updated = await tx.settlement.update({ where: { id }, data: { status: 'APPROVED', version: { increment: 1 } }, select: { id: true, companyId: true, reference: true, status: true, total: true, currency: true, version: true } }); await this.history(tx, id, settlement.status, 'APPROVED', 'SETTLEMENT_APPROVED', actor.userId); await audit(tx, { actor, requestId: `settlement-approve:${key}` }, 'SETTLEMENT_APPROVED', 'Settlement', id, { status: updated.status, version: updated.version }); return updated; });
  }
  async pay(actor: Actor, id: string, dto: SettlementPaymentDto, key: string | undefined) {
    if (!has(actor, 'settlement:manage')) throw new ForbiddenException(); return this.idempotent(actor, key, 'SETTLEMENT_PAY', { id, ...dto }, async tx => { const settlement = await this.lockSettlement(tx, id); if (!['APPROVED', 'PARTIALLY_PAID'].includes(settlement.status)) throw new ConflictException({ code: 'SETTLEMENT_NOT_PAYABLE' }); const amount = money(dto.amount); const targetDirection = settlement.total.isNegative() ? 'TO_PLATFORM' : 'TO_PROVIDER'; if (dto.direction !== targetDirection || amount.isZero()) throw new ConflictException({ code: 'SETTLEMENT_DIRECTION_INVALID' }); const paid = (await tx.settlementPayment.findMany({ where: { settlementId: id, direction: targetDirection }, select: { amount: true } })).reduce((sum, payment) => sum.add(payment.amount), zero()); const remaining = settlement.total.abs().sub(paid); if (amount.gt(remaining)) throw new ConflictException({ code: 'SETTLEMENT_OVERPAYMENT' }); const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date(); if (!Number.isFinite(paidAt.getTime())) throw new BadRequestException({ code: 'SETTLEMENT_PAID_AT_INVALID' }); const payment = await tx.settlementPayment.create({ data: { settlementId: id, amount, direction: dto.direction, reference: dto.reference, paidAt }, select: { id: true, settlementId: true, amount: true, direction: true, reference: true, paidAt: true } }); const next: Status = amount.eq(remaining) ? 'PAID' : 'PARTIALLY_PAID'; await tx.settlement.update({ where: { id }, data: { status: next, version: { increment: 1 } } }); await this.history(tx, id, settlement.status, next, dto.reason ?? 'SETTLEMENT_PAYMENT_RECORDED', actor.userId); await audit(tx, { actor, requestId: `settlement-pay:${key}` }, 'SETTLEMENT_PAYMENT_RECORDED', 'SettlementPayment', payment.id, { settlementId: id, amount: amount.toString(), direction: dto.direction, status: next }); return { payment, settlementId: id, status: next }; });
  }
  async reconcile(actor: Actor, id: string, key: string | undefined) {
    if (!has(actor, 'settlement:manage')) throw new ForbiddenException();
    return this.idempotent(actor, key, 'SETTLEMENT_RECONCILE', { id }, async tx => {
      const settlement = await this.lockSettlement(tx, id);
      if (!['PAID', 'RECONCILED'].includes(settlement.status)) throw new ConflictException({ code: 'SETTLEMENT_NOT_RECONCILABLE' });
      const items = await tx.settlementItem.findMany({ where: { settlementId: id }, include: { payable: true, allocations: { include: { payment: { include: { cashCollection: true, refunds: { where: { status: 'SUCCEEDED' } } } } } } } });
      const expected = items.reduce((sum, item) => sum.add(item.payable.netCustomerAmount ?? item.payable.customerAmount), zero());
      const refunds = items.reduce((sum, item) => sum.add(item.payable.refundedAmount ?? zero()), zero());
      const allocated = items.reduce((sum, item) => sum.add(item.allocations.reduce((inner, allocation) => inner.add(allocation.amount), zero())), zero());
      const liveCollected = items.reduce((sum, item) => sum.add(item.allocations.reduce((inner, allocation) => inner.add(allocation.payment.amount).sub(allocation.payment.refunds.reduce((refundSum, refund) => refundSum.add(refund.amount), zero())), zero())), zero());
      const liveCash = items.reduce((sum, item) => sum.add(item.allocations.reduce((inner, allocation) => inner.add(allocation.payment.cashCollection?.amount ?? zero()), zero())), zero());
      const liveCashPaymentTotal = items.reduce((sum, item) => sum.add(item.allocations.filter(allocation => allocation.payment.method === 'CASH').reduce((inner, allocation) => inner.add(allocation.payment.amount), zero())), zero());
      const snapCash = items.reduce((sum, item) => sum.add(item.payable.cashCollected), zero());
      const targetDirection = settlement.total.isNegative() ? 'TO_PLATFORM' : 'TO_PROVIDER';
      const payout = (await tx.settlementPayment.findMany({ where: { settlementId: id, direction: targetDirection }, select: { amount: true } })).reduce((sum, payment) => sum.add(payment.amount), zero());
      const collectionDifference = expected.sub(allocated).toDecimalPlaces(2);
      const paymentDifference = liveCollected.sub(allocated).toDecimalPlaces(2);
      const cashDifference = liveCash.sub(snapCash).toDecimalPlaces(2);
      const cashReceiptDifference = liveCash.sub(liveCashPaymentTotal).toDecimalPlaces(2);
      const payoutDifference = settlement.total.abs().sub(payout).toDecimalPlaces(2);
      const difference = collectionDifference.abs().add(paymentDifference.abs()).add(cashDifference.abs()).add(cashReceiptDifference.abs()).add(payoutDifference.abs()).toDecimalPlaces(2);
      const runNumber = (await tx.settlementReconciliation.count({ where: { settlementId: id } })) + 1;
      const status = difference.isZero() ? 'MATCHED' : 'DISCREPANCY';
      const result = await tx.settlementReconciliation.create({ data: { settlementId: id, runNumber, status, expectedCustomerTotal: expected, allocatedPaymentTotal: allocated, refundTotal: refunds, payoutTotal: payout, difference, details: jsonValue({ collectionDifference: collectionDifference.toString(), paymentDifference: paymentDifference.toString(), cashDifference: cashDifference.toString(), cashReceiptDifference: cashReceiptDifference.toString(), payoutDifference: payoutDifference.toString(), liveCollected: liveCollected.toString(), liveCash: liveCash.toString(), liveCashPaymentTotal: liveCashPaymentTotal.toString(), expectedCustomerTotal: expected.toString(), allocatedPaymentTotal: allocated.toString(), refundTotal: refunds.toString(), payoutTotal: payout.toString() }), reconciledByUserId: actor.userId } });
      if (status === 'MATCHED' && settlement.status === 'PAID') { await tx.settlement.update({ where: { id }, data: { status: 'RECONCILED', version: { increment: 1 } } }); await this.history(tx, id, 'PAID', 'RECONCILED', 'SETTLEMENT_RECONCILED', actor.userId); }
      await audit(tx, { actor, requestId: `settlement-reconcile:${key}` }, status === 'MATCHED' ? 'SETTLEMENT_RECONCILED' : 'SETTLEMENT_DISCREPANCY_DETECTED', 'SettlementReconciliation', result.id, { settlementId: id, status, difference: difference.toString() });
      return result;
    });
  }
  async close(actor: Actor, id: string, key: string | undefined) { if (!has(actor, 'settlement:manage')) throw new ForbiddenException(); return this.idempotent(actor, key, 'SETTLEMENT_CLOSE', { id }, async tx => { const settlement = await this.lockSettlement(tx, id); if (settlement.status !== 'RECONCILED') throw new ConflictException({ code: 'SETTLEMENT_NOT_CLOSEABLE' }); const updated = await tx.settlement.update({ where: { id }, data: { status: 'CLOSED', version: { increment: 1 } }, select: { id: true, companyId: true, reference: true, status: true, total: true, currency: true, version: true } }); await this.history(tx, id, 'RECONCILED', 'CLOSED', 'SETTLEMENT_CLOSED', actor.userId); await audit(tx, { actor, requestId: `settlement-close:${key}` }, 'SETTLEMENT_CLOSED', 'Settlement', id, { status: updated.status }); return updated; }); }
  async cancel(actor: Actor, id: string, dto: SettlementCommandDto, key: string | undefined) { if (!has(actor, 'settlement:manage')) throw new ForbiddenException(); return this.idempotent(actor, key, 'SETTLEMENT_CANCEL', { id, ...dto }, async tx => { const settlement = await this.lockSettlement(tx, id); if (!['DRAFT', 'CALCULATED', 'READY_FOR_REVIEW', 'APPROVED'].includes(settlement.status)) throw new ConflictException({ code: 'SETTLEMENT_NOT_CANCELLABLE' }); const updated = await tx.settlement.update({ where: { id }, data: { status: 'CANCELLED', version: { increment: 1 } }, select: { id: true, companyId: true, reference: true, status: true, total: true, currency: true, version: true } }); await this.history(tx, id, settlement.status, 'CANCELLED', dto.reason ?? 'SETTLEMENT_CANCELLED', actor.userId); await audit(tx, { actor, requestId: `settlement-cancel:${key}` }, 'SETTLEMENT_CANCELLED', 'Settlement', id, { status: updated.status, reason: dto.reason }); return updated; }); }
  async reverse(actor: Actor, id: string, dto: SettlementCommandDto, key: string | undefined) { if (!has(actor, 'settlement:manage')) throw new ForbiddenException(); return this.idempotent(actor, key, 'SETTLEMENT_REVERSE', { id, ...dto }, async tx => { const settlement = await this.lockSettlement(tx, id); if (!['PAID', 'RECONCILED', 'CLOSED'].includes(settlement.status)) throw new ConflictException({ code: 'SETTLEMENT_NOT_REVERSIBLE' }); const updated = await tx.settlement.update({ where: { id }, data: { status: 'REVERSED', version: { increment: 1 } }, select: { id: true, companyId: true, reference: true, status: true, total: true, currency: true, version: true } }); await this.history(tx, id, settlement.status, 'REVERSED', dto.reason ?? 'SETTLEMENT_REVERSED', actor.userId); await audit(tx, { actor, requestId: `settlement-reverse:${key}` }, 'SETTLEMENT_REVERSED', 'Settlement', id, { status: updated.status, reason: dto.reason }); return updated; }); }
}
