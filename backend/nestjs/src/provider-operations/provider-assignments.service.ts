import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type AssignmentStatus } from '@prisma/client';
import type { Actor } from '../auth/authorization.js';
import { assignmentScope } from '../auth/authorization.js';
import { PrismaService } from '../database/database.module.js';
import type { ProviderAssignmentListDto, ProviderCashWorklistDto } from './provider-assignments.dto.js';

const assignmentSummarySelect = {
  id: true, bookingId: true, companyId: true, teamId: true, status: true,
  startsAt: true, endsAt: true, assignedAt: true, expiresAt: true, acceptedAt: true, reason: true,
  company: { select: { id: true, name: true, status: true } },
  team: { select: { id: true, name: true, status: true, active: true } },
  booking: { select: {
    bookingNumber: true, status: true, scheduledAt: true, estimatedEndAt: true,
    serviceSnapshot: true, addressSnapshot: true,
    payments: { select: { method: true, status: true, amount: true, currency: true,
      cashCollection: { select: { collectedAt: true, reconciledAt: true } } }, orderBy: { createdAt: 'desc' as const }, take: 1 },
  } },
} as const;

const assignmentDetailSelect = {
  ...assignmentSummarySelect,
  booking: { select: {
    ...assignmentSummarySelect.booking.select,
    instructions: true, propertySnapshot: true,
    extras: { select: { name: true, quantity: true }, orderBy: { id: 'asc' as const } },
  } },
  proofs: { select: { id: true, storageKey: true, mimeType: true, byteSize: true, createdAt: true }, orderBy: { createdAt: 'asc' as const } },
} as const;

type SummaryRow = Prisma.AssignmentGetPayload<{ select: typeof assignmentSummarySelect }>;
type DetailRow = Prisma.AssignmentGetPayload<{ select: typeof assignmentDetailSelect }>;

function cashAssignmentScope(actor: Actor): Prisma.AssignmentWhereInput {
  const scopes = actor.scopes.flatMap(scope => scope.role === 'TEAM_LEADER_CLEANER' && scope.companyId && scope.teamId
    && scope.permissions.includes('cash:team') && scope.permissions.includes('assignment:team')
    ? [{ companyId: scope.companyId, teamId: scope.teamId }] : []);
  if (!scopes.length) throw new ForbiddenException();
  return { OR: scopes };
}

@Injectable()
export class ProviderAssignmentsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  private statusWhere(query: ProviderAssignmentListDto, now: Date): Prisma.AssignmentWhereInput {
    if (query.status && query.view) throw new BadRequestException({ code: 'PROVIDER_ASSIGNMENT_FILTER_INVALID' });
    if (query.status === 'OFFERED') return { status: 'OFFERED', expiresAt: { gt: now } };
    if (query.status === 'EXPIRED') return { OR: [{ status: 'EXPIRED' }, { status: 'OFFERED', expiresAt: { lte: now } }] };
    if (query.status) return { status: query.status as AssignmentStatus };
    if (query.view === 'PENDING') return { status: 'OFFERED', expiresAt: { gt: now } };
    if (query.view === 'ACTIVE') return { status: 'ACCEPTED' };
    if (query.view === 'HISTORY') return { OR: [{ status: { in: ['REJECTED', 'EXPIRED', 'CANCELLED', 'COMPLETED'] } }, { status: 'OFFERED', expiresAt: { lte: now } }] };
    return {};
  }

  async list(actor: Actor, query: ProviderAssignmentListDto) {
    const scope = assignmentScope(actor);
    const now = new Date();
    const rows = await this.db.assignment.findMany({
      where: { AND: [scope, this.statusWhere(query, now)] }, select: assignmentSummarySelect,
      orderBy: [{ startsAt: 'asc' }, { assignedAt: 'desc' }, { id: 'asc' }], take: query.limit, skip: query.offset,
    });
    return rows.map(row => this.summary(actor, row, now));
  }

  async detail(actor: Actor, id: string) {
    const scope = assignmentScope(actor);
    const row = await this.db.assignment.findFirst({ where: { AND: [{ id }, scope] }, select: assignmentDetailSelect });
    if (!row) throw new NotFoundException();
    return this.detailProjection(actor, row, new Date());
  }

  async cashWorklist(actor: Actor, query: ProviderCashWorklistDto) {
    const scope = cashAssignmentScope(actor);
    const cashPayment: Prisma.PaymentWhereInput = { method: 'CASH',
      ...(query.state === 'EXPECTED' ? { cashCollection: null }
        : query.state === 'COLLECTED' ? { cashCollection: { is: { reconciledAt: null } } }
          : query.state === 'RECONCILED' ? { cashCollection: { is: { reconciledAt: { not: null } } } } : {}) };
    const rows = await this.db.assignment.findMany({
      where: { AND: [scope, { status: { in: ['ACCEPTED', 'COMPLETED'] }, booking: { payments: { some: cashPayment } } }] },
      select: assignmentSummarySelect, orderBy: [{ startsAt: 'asc' }, { id: 'asc' }], take: query.limit, skip: query.offset,
    });
    return rows.map(row => this.summary(actor, row, new Date()));
  }

  private effectiveStatus(row: SummaryRow, now: Date): AssignmentStatus {
    return row.status === 'OFFERED' && row.expiresAt <= now ? 'EXPIRED' : row.status;
  }

  private cash(actor: Actor, row: SummaryRow) {
    const authorized = actor.scopes.some(scope => scope.role === 'TEAM_LEADER_CLEANER'
      && scope.companyId === row.companyId && scope.teamId === row.teamId
      && scope.permissions.includes('cash:team') && scope.permissions.includes('assignment:team'));
    if (!authorized) return null;
    const payment = row.booking.payments[0];
    if (!payment || payment.method !== 'CASH') return null;
    const collectionState = payment.cashCollection?.reconciledAt ? 'RECONCILED'
      : payment.cashCollection?.collectedAt ? 'COLLECTED' : 'EXPECTED';
    return { expectedAmount: payment.amount, currency: payment.currency, collectionState,
      canCollect: row.status === 'COMPLETED' && ['CLEANING_COMPLETED', 'PAYMENT_RECONCILIATION'].includes(row.booking.status)
        && !payment.cashCollection && ['CONFIRMED', 'CASH_SELECTED'].includes(payment.status) };
  }

  private summary(actor: Actor, row: SummaryRow, now: Date) {
    const service = row.booking.serviceSnapshot as Record<string, unknown>;
    const address = row.booking.addressSnapshot as Record<string, unknown>;
    const status = this.effectiveStatus(row, now);
    return {
      id: row.id, bookingId: row.bookingId, bookingNumber: row.booking.bookingNumber,
      status, bookingStatus: row.booking.status,
      startsAt: row.startsAt, endsAt: row.endsAt, assignedAt: row.assignedAt, expiresAt: row.expiresAt, acceptedAt: row.acceptedAt,
      rejectionReason: row.status === 'REJECTED' ? row.reason : null,
      company: { id: row.company.id, name: row.company.name, status: row.company.status },
      team: { id: row.team.id, name: row.team.name, status: row.team.status, active: row.team.active },
      service: { name: service.name, nameAr: service.nameAr, durationMinutes: service.durationMinutes },
      location: { addressText: address.addressText },
      canAccept: status === 'OFFERED' && row.booking.status === 'TEAM_ASSIGNED',
      canReject: status === 'OFFERED' && row.booking.status === 'TEAM_ASSIGNED',
      canMarkOnTheWay: status === 'ACCEPTED' && row.booking.status === 'TEAM_ACCEPTED',
      canStartCleaning: status === 'ACCEPTED' && row.booking.status === 'TEAM_ON_THE_WAY',
      canCompleteCleaning: status === 'ACCEPTED' && row.booking.status === 'CLEANING_STARTED',
      canMarkTeamNoShow: status === 'ACCEPTED' && row.booking.status === 'TEAM_ON_THE_WAY',
      canMarkCustomerNoShow: status === 'ACCEPTED' && row.booking.status === 'CLEANING_STARTED',
      cash: this.cash(actor, row),
    };
  }

  private detailProjection(actor: Actor, row: DetailRow, now: Date) {
    const summary = this.summary(actor, row, now);
    const address = row.booking.addressSnapshot as Record<string, unknown>;
    const property = row.booking.propertySnapshot as Record<string, unknown>;
    return { ...summary,
      location: { addressText: address.addressText, label: address.label, latitude: address.latitude, longitude: address.longitude },
      property: { type: property.type, size: property.size, rooms: property.rooms, bathrooms: property.bathrooms },
      extras: row.booking.extras,
      instructions: row.booking.instructions,
      completionProofs: row.proofs,
      canSubmitCompletionProof: row.status === 'COMPLETED'
        && ['CLEANING_COMPLETED', 'PAYMENT_RECONCILIATION', 'COMPLETED'].includes(row.booking.status),
    };
  }
}
