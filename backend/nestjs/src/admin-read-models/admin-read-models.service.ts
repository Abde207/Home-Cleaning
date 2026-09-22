import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type BookingStatus, type PaymentMethod } from '@prisma/client';
import { PrismaService } from '../database/database.module.js';
import type { Actor } from '../auth/authorization.js';
import { dispatchConfig } from '../dispatch/dispatch.config.js';
import type { AdminBookingListQueryDto, AdminDashboardQueryDto, AuditLogQueryDto } from './admin-read-models.dto.js';
import { adminBookingDetailSelect, adminBookingSummarySelect } from './admin-read-models.dto.js';

type StatusCount = { status: string; count: number };
type JsonObject = { [key: string]: Prisma.JsonValue };

function statusCounts(rows: { status: string; _count: { _all: number } }[]): StatusCount[] {
  return rows.map(row => ({ status: row.status, count: row._count._all }));
}

function parseDate(value: string | undefined, code: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new BadRequestException({ code, message: 'The date range is invalid.' });
  return date;
}

function range(fromValue: string | undefined, toValue: string | undefined, maxDays: number, defaultFrom: Date, defaultTo: Date) {
  const from = parseDate(fromValue, 'ADMIN_DATE_RANGE_INVALID') ?? defaultFrom;
  const to = parseDate(toValue, 'ADMIN_DATE_RANGE_INVALID') ?? defaultTo;
  if (from >= to || to.getTime() - from.getTime() > maxDays * 86_400_000) throw new BadRequestException({ code: 'ADMIN_DATE_RANGE_INVALID', message: 'The date range is invalid.' });
  return { from, to };
}

function redact(value: Prisma.JsonValue): Prisma.JsonValue {
  if (Array.isArray(value)) return value.map(item => redact(item)) as Prisma.JsonArray;
  if (value !== null && typeof value === 'object') {
    const result: JsonObject = {};
    for (const [key, child] of Object.entries(value)) {
      if (/(token|otp|code|secret|credential|password|signature|payload|device)/i.test(key)) result[key] = '[REDACTED]';
      else result[key] = redact(child as Prisma.JsonValue);
    }
    return result;
  }
  return value;
}

@Injectable()
export class AdminReadModelsService {
  private readonly locationMaxAgeMinutes = dispatchConfig().locationMaxAgeMinutes;

  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async dashboard(dto: AdminDashboardQueryDto) {
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const period = range(dto.from, dto.to, 31, dayStart, now);
    const createdAt = { gte: period.from, lt: period.to };
    const assignedAt = { gte: period.from, lt: period.to };
    const staleBefore = new Date(now.getTime() - this.locationMaxAgeMinutes * 60_000);

    const [bookings, assignments, attentionRows, paymentPending, paymentFailed, cashExpected, cashUnreconciled,
      refundPending, companies, teams, staleTeamLocations, notificationsPending, notificationsFailed,
      settlementsReady, reconciliationRows, recentDispatchAttempts] = await Promise.all([
      this.db.booking.groupBy({ by: ['status'], where: { createdAt }, _count: { _all: true } }),
      this.db.assignment.groupBy({ by: ['status'], where: { assignedAt }, _count: { _all: true } }),
      this.db.booking.groupBy({ by: ['status'], where: { status: { in: ['NO_TEAM_AVAILABLE', 'REJECTED', 'TEAM_NO_SHOW', 'PAYMENT_RECONCILIATION', 'REFUND_PENDING'] } }, _count: { _all: true } }),
      this.db.payment.count({ where: { status: 'PENDING' } }),
      this.db.payment.count({ where: { status: 'FAILED' } }),
      this.db.payment.count({ where: { method: 'CASH', status: { in: ['CASH_SELECTED', 'CASH_COLLECTED', 'RECONCILED'] } } }),
      this.db.payment.count({ where: { method: 'CASH', cashCollection: { is: { reconciledAt: null } }, status: 'CASH_COLLECTED' } }),
      this.db.refund.count({ where: { status: 'PENDING' } }),
      this.db.company.groupBy({ by: ['status'], _count: { _all: true } }),
      this.db.team.groupBy({ by: ['status'], _count: { _all: true } }),
      this.db.team.count({ where: { active: true, OR: [{ locationAt: null }, { locationAt: { lt: staleBefore } }] } }),
      this.db.notificationDelivery.count({ where: { status: 'PENDING' } }),
      this.db.notificationDelivery.count({ where: { status: 'FAILED' } }),
      this.db.settlement.count({ where: { status: 'READY_FOR_REVIEW' } }),
      this.db.settlement.findMany({ select: { reconciliations: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { difference: true } } } }),
      this.db.dispatchAttempt.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100, select: { id: true, bookingId: true, sequence: true, outcome: true, reason: true, createdAt: true, booking: { select: { bookingNumber: true } } } }),
    ]);

    const byAttention = new Map(attentionRows.map(row => [row.status, row._count._all]));
    const discrepancies = reconciliationRows.filter(row => row.reconciliations[0] && !row.reconciliations[0].difference.eq(0)).length;
    return {
      generatedAt: now,
      range: { from: period.from, to: period.to },
      bookingsByStatus: statusCounts(bookings),
      assignmentsByStatus: statusCounts(assignments),
      attention: {
        noTeamAvailable: byAttention.get('NO_TEAM_AVAILABLE') ?? 0,
        rejected: byAttention.get('REJECTED') ?? 0,
        teamNoShow: byAttention.get('TEAM_NO_SHOW') ?? 0,
        paymentReconciliation: byAttention.get('PAYMENT_RECONCILIATION') ?? 0,
        refundPending: byAttention.get('REFUND_PENDING') ?? 0,
      },
      finance: { paymentPending, paymentFailed, cashExpected, cashCollectedUnreconciled: cashUnreconciled, settlementsReadyForReview: settlementsReady, settlementDiscrepancies: discrepancies },
      providers: { companiesByStatus: statusCounts(companies), teamsByStatus: statusCounts(teams), staleTeamLocations },
      notifications: { pending: notificationsPending, failed: notificationsFailed },
      recentDispatchAttempts: recentDispatchAttempts.map(({ booking, ...row }) => ({ ...row, bookingNumber: booking.bookingNumber })),
    };
  }

  async bookings(dto: AdminBookingListQueryDto) {
    const scheduledFrom = parseDate(dto.scheduledFrom, 'ADMIN_DATE_RANGE_INVALID');
    const scheduledTo = parseDate(dto.scheduledTo, 'ADMIN_DATE_RANGE_INVALID');
    const createdFrom = parseDate(dto.createdFrom, 'ADMIN_DATE_RANGE_INVALID');
    const createdTo = parseDate(dto.createdTo, 'ADMIN_DATE_RANGE_INVALID');
    if (scheduledFrom && scheduledTo && scheduledFrom >= scheduledTo) throw new BadRequestException({ code: 'ADMIN_DATE_RANGE_INVALID' });
    if (createdFrom && createdTo && createdFrom >= createdTo) throw new BadRequestException({ code: 'ADMIN_DATE_RANGE_INVALID' });
    if (dto.companyId && dto.teamId && !await this.db.team.findFirst({ where: { id: dto.teamId, companyId: dto.companyId }, select: { id: true } }))
      throw new BadRequestException({ code: 'ADMIN_FILTER_RELATION_INVALID', message: 'The team does not belong to the company.' });

    const where: Prisma.BookingWhereInput = {};
    if (dto.status) where.status = dto.status as BookingStatus;
    if (dto.paymentMethod) where.paymentMethod = dto.paymentMethod as PaymentMethod;
    if (dto.customerId) where.customerId = dto.customerId;
    if (dto.serviceId) where.serviceId = dto.serviceId;
    if (dto.bookingNumber) where.bookingNumber = { startsWith: dto.bookingNumber };
    if (scheduledFrom || scheduledTo) where.scheduledAt = { ...(scheduledFrom ? { gte: scheduledFrom } : {}), ...(scheduledTo ? { lt: scheduledTo } : {}) };
    if (createdFrom || createdTo) where.createdAt = { ...(createdFrom ? { gte: createdFrom } : {}), ...(createdTo ? { lt: createdTo } : {}) };
    if (dto.companyId || dto.teamId) where.assignments = { some: { ...(dto.companyId ? { companyId: dto.companyId } : {}), ...(dto.teamId ? { teamId: dto.teamId } : {}) } };

    const rows = await this.db.booking.findMany({ where, select: adminBookingSummarySelect, orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }], take: dto.limit, skip: dto.offset });
    return rows.map(({ assignments, payments, customer, service, ...row }) => ({
      ...row,
      customer: { id: customer.id, name: customer.user.name, phone: customer.user.phone, status: customer.user.status },
      service,
      currentAssignment: assignments[0] ?? null,
      payment: payments[0] ?? null,
    }));
  }

  async bookingDetail(id: string) {
    const row = await this.db.booking.findUnique({ where: { id }, select: adminBookingDetailSelect });
    if (!row) throw new NotFoundException();
    const { customer, ...booking } = row;
    return {
      ...booking,
      customer: { id: customer.id, userId: customer.user.id, name: customer.user.name, phone: customer.user.phone, status: customer.user.status },
      service: row.service,
    };
  }

  async auditList(dto: AuditLogQueryDto) {
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 90 * 86_400_000);
    const period = range(dto.createdFrom, dto.createdTo, dto.actorUserId || dto.resourceId ? 365 * 10 : 90, defaultFrom, now);
    const where: Prisma.AuditLogWhereInput = { createdAt: { gte: period.from, lt: period.to } };
    if (dto.actorUserId) where.actorUserId = dto.actorUserId;
    if (dto.action) where.action = { contains: dto.action, mode: 'insensitive' };
    if (dto.resourceType) where.resourceType = { contains: dto.resourceType, mode: 'insensitive' };
    if (dto.resourceId) where.resourceId = dto.resourceId;
    if (dto.requestId) where.requestId = { contains: dto.requestId, mode: 'insensitive' };
    const rows = await this.db.auditLog.findMany({ where, take: dto.limit, skip: dto.offset, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: {
      id: true, action: true, resourceType: true, resourceId: true, reason: true, requestId: true, createdAt: true,
      actor: { select: { id: true, name: true, phone: true, status: true } },
    } });
    return rows;
  }

  async auditDetail(id: string) {
    const row = await this.db.auditLog.findUnique({ where: { id }, select: {
      id: true, action: true, resourceType: true, resourceId: true, reason: true, requestId: true, createdAt: true,
      before: true, after: true, actor: { select: { id: true, name: true, phone: true, status: true } },
    } });
    if (!row) throw new NotFoundException();
    return { ...row, before: row.before === null ? null : redact(row.before), after: row.after === null ? null : redact(row.after) };
  }
}
