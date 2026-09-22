import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type PaymentStatus } from '@prisma/client';
import { PrismaService } from '../database/database.module.js';
import type { Actor } from '../auth/authorization.js';
import type { AdminCashQueryDto, AdminPaymentQueryDto, AdminRefundQueryDto, AdminSettlementQueryDto } from './admin-finance.dto.js';

const paymentStatuses = ['PENDING', 'CONFIRMED', 'FAILED', 'CASH_SELECTED', 'CASH_COLLECTED', 'RECONCILED', 'PARTIALLY_REFUNDED', 'REFUNDED'] as const;
const paymentMethods = ['ONLINE', 'CASH'] as const;
const settlementStatuses = ['DRAFT', 'CALCULATED', 'READY_FOR_REVIEW', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'RECONCILED', 'CLOSED', 'CANCELLED', 'REVERSED'] as const;
const zero = () => new Prisma.Decimal(0);
const has = (actor: Actor, permission: string) => actor.scopes.some(scope => scope.permissions.includes(permission));

function date(value?: string) {
  if (!value) return undefined;
  const result = new Date(value);
  return Number.isFinite(result.getTime()) ? result : undefined;
}

function assertDates(from?: string, to?: string, label = 'DATE_RANGE_INVALID') {
  const start = date(from); const end = date(to);
  if ((from && !start) || (to && !end) || (start && end && end <= start)) throw new BadRequestException({ code: label });
}

function serviceSnapshot(snapshot: Prisma.JsonValue) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const value = snapshot as Record<string, Prisma.JsonValue>;
  return { name: typeof value.name === 'string' ? value.name : null, nameAr: typeof value.nameAr === 'string' ? value.nameAr : null };
}

function cashState(payment: { status: string; amount: Prisma.Decimal; cashCollection: { amount: Prisma.Decimal; reconciledAt: Date | null } | null }) {
  if (!payment.cashCollection) return payment.status === 'CASH_SELECTED' || payment.status === 'CONFIRMED' ? 'EXPECTED' : 'EXCEPTION';
  if (!payment.cashCollection.amount.eq(payment.amount)) return 'EXCEPTION';
  return payment.cashCollection.reconciledAt ? 'RECONCILED' : 'COLLECTED';
}

@Injectable()
export class AdminFinanceService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  private require(actor: Actor, ...permissions: string[]) {
    if (!permissions.some(permission => has(actor, permission))) throw new ForbiddenException();
  }

  async payments(actor: Actor, query: AdminPaymentQueryDto) {
    this.require(actor, 'payment:read', 'payment:manage');
    assertDates(query.createdFrom, query.createdTo);
    if (query.cashState && query.method && query.method !== 'CASH') throw new BadRequestException({ code: 'PAYMENT_FILTER_CONFLICT' });
    const bookingWhere: Prisma.BookingWhereInput = {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.bookingNumber ? { bookingNumber: { contains: query.bookingNumber, mode: 'insensitive' } } : {}),
      ...(query.companyId ? { assignments: { some: { companyId: query.companyId } } } : {}),
    };
    const where: Prisma.PaymentWhereInput = {
      ...(query.status ? { status: query.status as PaymentStatus } : {}),
      ...(query.method ? { method: query.method as (typeof paymentMethods)[number] } : {}),
      ...(query.bookingId ? { bookingId: query.bookingId } : {}),
      ...(Object.keys(bookingWhere).length ? { booking: bookingWhere } : {}),
      ...(query.createdFrom || query.createdTo ? { createdAt: { ...(date(query.createdFrom) ? { gte: date(query.createdFrom) } : {}), ...(date(query.createdTo) ? { lt: date(query.createdTo) } : {}) } } : {}),
      ...(query.hasRefund === true ? { refunds: { some: {} } } : query.hasRefund === false ? { refunds: { none: {} } } : {}),
      ...(query.cashState ? { method: 'CASH' } : {}),
      ...(query.cashState === 'EXPECTED' ? { cashCollection: { is: null } } : {}),
      ...(query.cashState === 'COLLECTED' ? { cashCollection: { is: { reconciledAt: null } } } : {}),
      ...(query.cashState === 'RECONCILED' ? { cashCollection: { is: { reconciledAt: { not: null } } } } : {}),
    };
    const rows = await this.db.payment.findMany({
      where,
      take: query.limit,
      skip: query.offset,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true, bookingId: true, method: true, status: true, amount: true, currency: true, provider: true, transactionReference: true, createdAt: true, updatedAt: true,
        booking: { select: { id: true, bookingNumber: true, status: true, scheduledAt: true, customer: { select: { id: true, user: { select: { name: true, phone: true } } } } } },
        refunds: { select: { amount: true, status: true } },
        cashCollection: { select: { id: true, amount: true, collectedAt: true, reconciledAt: true, collectorCompanyId: true, collectorTeamId: true } },
      },
    });
    return rows.map(row => ({
      id: row.id,
      booking: row.booking,
      customer: { id: row.booking.customer.id, name: row.booking.customer.user.name, phone: row.booking.customer.user.phone },
      method: row.method, status: row.status, amount: row.amount, currency: row.currency, provider: row.provider, transactionReference: row.transactionReference,
      refundTotal: row.refunds.filter(refund => refund.status === 'SUCCEEDED').reduce((sum, refund) => sum.add(refund.amount), zero()),
      cashCollection: row.cashCollection,
      createdAt: row.createdAt, updatedAt: row.updatedAt,
    }));
  }

  async payment(actor: Actor, id: string) {
    this.require(actor, 'payment:read', 'payment:manage');
    const payment = await this.db.payment.findUnique({
      where: { id },
      select: {
        id: true, bookingId: true, method: true, status: true, amount: true, currency: true, provider: true, transactionReference: true, createdAt: true, updatedAt: true,
        booking: { select: { id: true, bookingNumber: true, status: true, scheduledAt: true, estimatedEndAt: true, customer: { select: { id: true, user: { select: { name: true, phone: true } } } }, serviceSnapshot: true, history: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, previousStatus: true, newStatus: true, reason: true, createdAt: true } }, assignments: { orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }], select: { id: true, status: true, assignedAt: true, acceptedAt: true, company: { select: { id: true, name: true } }, team: { select: { id: true, name: true } } } } } },
        attempts: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, provider: true, attemptNumber: true, status: true, providerReference: true, amount: true, currency: true, failureCode: true, failureMessage: true, createdAt: true, updatedAt: true } },
        statusHistory: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, previousStatus: true, newStatus: true, reason: true, provider: true, eventId: true, changedByUserId: true, createdAt: true } },
        transactions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, type: true, amount: true, reference: true, createdAt: true } },
        events: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, provider: true, eventId: true, type: true, signatureVerified: true, verifiedAt: true, createdAt: true } },
        refunds: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, amount: true, status: true, provider: true, reference: true, reason: true, failureCode: true, createdAt: true, updatedAt: true, history: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, previousStatus: true, newStatus: true, provider: true, reference: true, reason: true, createdAt: true } } } },
        cashCollection: { select: { id: true, amount: true, collectedByUserId: true, collectorCompanyId: true, collectorTeamId: true, collectedAt: true, reconciledAt: true, collectedBy: { select: { id: true, name: true } }, collectorCompany: { select: { id: true, name: true } }, collectorTeam: { select: { id: true, name: true } } } },
        settlementAllocations: { select: { id: true, amount: true, refundedAmount: true, allocatedAt: true, settlement: { select: { id: true, reference: true, status: true, companyId: true } } } },
      },
    });
    if (!payment) throw new NotFoundException();
    const { booking, refunds, cashCollection, settlementAllocations, ...base } = payment;
    return {
      ...base,
      booking: { ...booking, customer: { id: booking.customer.id, name: booking.customer.user.name, phone: booking.customer.user.phone }, service: serviceSnapshot(booking.serviceSnapshot) },
      refunds,
      refundTotal: refunds.filter(refund => refund.status === 'SUCCEEDED').reduce((sum, refund) => sum.add(refund.amount), zero()),
      cashCollection,
      cashState: payment.method === 'CASH' ? cashState(payment) : null,
      settlementAllocations,
    };
  }

  async refunds(actor: Actor, query: AdminRefundQueryDto) {
    this.require(actor, 'refund:read', 'refund:manage', 'payment:manage');
    assertDates(query.createdFrom, query.createdTo);
    const refundBookingWhere: Prisma.BookingWhereInput = {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.companyId ? { assignments: { some: { companyId: query.companyId } } } : {}),
    };
    const refundPaymentWhere: Prisma.PaymentWhereInput = {
      ...(query.bookingId ? { bookingId: query.bookingId } : {}),
      ...(Object.keys(refundBookingWhere).length ? { booking: refundBookingWhere } : {}),
    };
    const rows = await this.db.refund.findMany({
      where: {
        ...(query.status ? { status: query.status as 'PENDING' | 'SUCCEEDED' | 'FAILED' } : {}),
        ...(query.paymentId ? { paymentId: query.paymentId } : {}),
        ...(Object.keys(refundPaymentWhere).length ? { payment: refundPaymentWhere } : {}),
        ...(query.createdFrom || query.createdTo ? { createdAt: { ...(date(query.createdFrom) ? { gte: date(query.createdFrom) } : {}), ...(date(query.createdTo) ? { lt: date(query.createdTo) } : {}) } } : {}),
      },
      take: query.limit, skip: query.offset, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, paymentId: true, amount: true, status: true, provider: true, reference: true, reason: true, failureCode: true, createdAt: true, updatedAt: true, payment: { select: { booking: { select: { id: true, bookingNumber: true, status: true, scheduledAt: true, customer: { select: { id: true, user: { select: { name: true, phone: true } } } } } } } } },
    });
    return rows.map(({ payment, ...refund }) => { const { customer, ...booking } = payment.booking; return { ...refund, booking, customer: { id: customer.id, name: customer.user.name, phone: customer.user.phone } }; });
  }

  async cash(actor: Actor, query: AdminCashQueryDto) {
    this.require(actor, 'cash:read', 'payment:manage');
    assertDates(query.scheduledFrom, query.scheduledTo);
    if (query.companyId && query.teamId) {
      const team = await this.db.team.findFirst({ where: { id: query.teamId }, select: { companyId: true } });
      if (!team || team.companyId !== query.companyId) throw new BadRequestException({ code: 'CASH_FILTER_SCOPE_INVALID' });
    }
    const rows = await this.db.payment.findMany({
      where: { method: 'CASH', ...(query.bookingId ? { bookingId: query.bookingId } : {}), booking: { ...(query.scheduledFrom || query.scheduledTo ? { scheduledAt: { ...(date(query.scheduledFrom) ? { gte: date(query.scheduledFrom) } : {}), ...(date(query.scheduledTo) ? { lt: date(query.scheduledTo) } : {}) } } : {}), ...(query.companyId || query.teamId ? { assignments: { some: { ...(query.companyId ? { companyId: query.companyId } : {}), ...(query.teamId ? { teamId: query.teamId } : {}) } } } : {}) } },
      take: Math.min(1000, Math.max(query.limit * 5 + query.offset, query.limit)), skip: 0,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true, amount: true, currency: true, status: true,
        cashCollection: { select: { id: true, amount: true, collectedByUserId: true, collectedAt: true, reconciledAt: true } },
        booking: {
          select: {
            id: true, bookingNumber: true, status: true, scheduledAt: true,
            customer: { select: { id: true, user: { select: { name: true, phone: true } } } },
            assignments: { orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }], take: 1, select: { id: true, status: true, company: { select: { id: true, name: true } }, team: { select: { id: true, name: true } } } },
          },
        },
      },
    });
    const mapped = rows.map(row => {
      const state = cashState(row);
      const exceptionCodes = [
        ...(!row.cashCollection && !['CASH_SELECTED', 'CONFIRMED'].includes(row.status) ? ['MISSING_COLLECTION'] : []),
        ...(row.cashCollection && !row.cashCollection.amount.eq(row.amount) ? ['COLLECTION_AMOUNT_MISMATCH'] : []),
        ...(row.cashCollection && !row.cashCollection.reconciledAt ? ['RECONCILIATION_PENDING'] : []),
      ];
      return { paymentId: row.id, booking: { ...row.booking, customer: { id: row.booking.customer.id, name: row.booking.customer.user.name, phone: row.booking.customer.user.phone } }, expectedAmount: row.amount, currency: row.currency, state, assignment: row.booking.assignments[0] ? { id: row.booking.assignments[0].id, status: row.booking.assignments[0].status, company: row.booking.assignments[0].company, team: row.booking.assignments[0].team } : null, collection: row.cashCollection, exceptionCodes };
    }).filter(row => !query.state || row.state === query.state);
    return mapped.slice(query.offset, query.offset + query.limit);
  }

  async settlements(actor: Actor, query: AdminSettlementQueryDto) {
    this.require(actor, 'settlement:read', 'settlement:manage');
    assertDates(query.periodFrom, query.periodTo);
    const rows = await this.db.settlement.findMany({
      where: { ...(query.status ? { status: query.status as (typeof settlementStatuses)[number] } : {}), ...(query.companyId ? { companyId: query.companyId } : {}), ...(query.periodFrom || query.periodTo ? { periodStart: { ...(date(query.periodFrom) ? { gte: date(query.periodFrom) } : {}), ...(date(query.periodTo) ? { lt: date(query.periodTo) } : {}) } } : {}), ...(query.reconciliationStatus ? { reconciliations: { some: { status: query.reconciliationStatus } } } : {}) },
      take: query.limit, skip: query.offset, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, companyId: true, reference: true, status: true, periodStart: true, periodEnd: true, total: true, currency: true, version: true, createdAt: true, updatedAt: true, company: { select: { id: true, name: true, status: true } }, payments: { select: { amount: true, direction: true } }, reconciliations: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { status: true, difference: true, createdAt: true } }, _count: { select: { items: true, allocations: true } } },
    });
    return rows.map(({ payments, reconciliations, _count, ...row }) => ({ ...row, paidAmount: payments.reduce((sum, payment) => sum.add(payment.amount), zero()), payoutDirection: payments[0]?.direction ?? (row.total.isNegative() ? 'TO_PLATFORM' : 'TO_PROVIDER'), latestReconciliation: reconciliations[0] ?? null, itemCount: _count.items, allocationCount: _count.allocations }));
  }

  async settlement(actor: Actor, id: string) {
    this.require(actor, 'settlement:read', 'settlement:manage');
    const settlement = await this.db.settlement.findUnique({
      where: { id },
      select: {
        id: true, companyId: true, reference: true, status: true, periodStart: true, periodEnd: true, total: true, currency: true, version: true, createdAt: true, updatedAt: true,
        company: { select: { id: true, name: true, status: true } },
        items: {
          orderBy: { id: 'asc' },
          select: {
            id: true, amount: true,
            payable: {
              select: {
                id: true, customerAmount: true, commissionRate: true, platformCommission: true, providerAmount: true, cashCollected: true, netPayable: true, grossAmount: true, refundedAmount: true, netCustomerAmount: true, onlineCollected: true, calculatedAt: true,
                booking: { select: { id: true, bookingNumber: true, status: true, scheduledAt: true, customer: { select: { id: true, user: { select: { name: true, phone: true } } } }, serviceSnapshot: true, assignments: { orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }], take: 1, select: { id: true, status: true, company: { select: { id: true, name: true } }, team: { select: { id: true, name: true } } } } } },
              },
            },
            allocations: { orderBy: { allocatedAt: 'asc' }, select: { id: true, paymentId: true, amount: true, refundedAmount: true, allocatedAt: true } },
          },
        },
        payments: { orderBy: [{ paidAt: 'asc' }, { id: 'asc' }], select: { id: true, amount: true, direction: true, reference: true, paidAt: true, createdAt: true } },
        allocations: { orderBy: { allocatedAt: 'asc' }, select: { id: true, settlementItemId: true, paymentId: true, amount: true, refundedAmount: true, allocatedAt: true } },
        reconciliations: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, runNumber: true, status: true, expectedCustomerTotal: true, allocatedPaymentTotal: true, refundTotal: true, payoutTotal: true, difference: true, details: true, reconciledByUserId: true, createdAt: true } },
        history: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, previousStatus: true, newStatus: true, reason: true, changedByUserId: true, createdAt: true } },
      },
    });
    if (!settlement) throw new NotFoundException();
    return { ...settlement, items: settlement.items.map(item => ({ ...item, payable: { ...item.payable, booking: { ...item.payable.booking, customer: { id: item.payable.booking.customer.id, name: item.payable.booking.customer.user.name, phone: item.payable.booking.customer.user.phone }, service: serviceSnapshot(item.payable.booking.serviceSnapshot) } } })), paidAmount: settlement.payments.reduce((sum, payment) => sum.add(payment.amount), zero()), payoutDirection: settlement.payments[0]?.direction ?? (settlement.total.isNegative() ? 'TO_PLATFORM' : 'TO_PROVIDER') };
  }
}
