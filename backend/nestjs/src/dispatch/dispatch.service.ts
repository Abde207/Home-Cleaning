import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Actor } from '../auth/authorization.js';
import { assignmentScope } from '../auth/authorization.js';
import { PrismaService } from '../database/database.module.js';
import { BookingService, type DispatchBooking, type DispatchSelection } from '../booking/booking.service.js';
import type { LegacyManualAssignmentDto, ManualDispatchDto } from './dispatch.dto.js';
import { dispatchConfig } from './dispatch.config.js';
import { evaluateCandidate, rankCandidates, type CandidateDecision, type DispatchCandidate } from './dispatch.policy.js';

type Transaction = Prisma.TransactionClient;

@Injectable()
export class DispatchService {
  private readonly config = dispatchConfig();
  constructor(@Inject(PrismaService) private readonly db: PrismaService,
    @Inject(BookingService) private readonly bookings: BookingService) {}

  private requireDispatcher(actor: Actor) {
    if (!actor.scopes.some(scope => (scope.role === 'DISPATCHER' || scope.role === 'HOME_CLEAN_ADMIN') &&
      scope.companyId === null && scope.teamId === null && scope.permissions.includes('dispatch:manage'))) throw new ForbiddenException();
  }

  private operationalBooking(booking: Awaited<ReturnType<BookingService['dispatchOffer']>>) {
    return { id: booking.id, bookingNumber: booking.bookingNumber, status: booking.status,
      scheduledAt: booking.scheduledAt, estimatedEndAt: booking.estimatedEndAt,
      assignments: booking.assignments.map(row => ({ id: row.id, companyId: row.companyId,
        teamId: row.teamId, status: row.status, assignedAt: row.assignedAt, expiresAt: row.expiresAt })) };
  }

  private async select(tx: Transaction, booking: DispatchBooking, manual?: ManualDispatchDto): Promise<DispatchSelection> {
    const now = new Date();
    if (booking.estimatedEndAt <= now) throw new ConflictException({ code: 'DISPATCH_SLOT_PASSED' });
    const previous = await tx.assignment.findMany({ where: { bookingId: booking.id }, select: { teamId: true } });
    const offers = await tx.dispatchAttempt.count({ where: { bookingId: booking.id, outcome: 'ASSIGNMENT_OFFERED' } });
    if (!manual && offers >= this.config.maxAttempts) return { candidates: [{ policy: this.config, excludedTeams: previous.map(row => row.teamId) }], reason: 'RETRY_LIMIT_REACHED' };
    const where: Prisma.TeamWhereInput = { active: true, company: { status: 'ACTIVE' }, capabilities: { some: { serviceId: booking.serviceId } },
      ...(manual ? { id: manual.teamId, companyId: manual.companyId } : {}) };
    // Lock candidate teams in stable order before reading workload. Competing dispatches use the same locks.
    const initial = await tx.team.findMany({ where, select: { id: true }, orderBy: { id: 'asc' } });
    for (const team of initial) await tx.$queryRaw`SELECT id FROM "Team" WHERE id = ${team.id}::uuid FOR UPDATE`;
    const teams = await tx.team.findMany({ where: { ...where, id: { in: initial.map(team => team.id) } },
      include: { company: { include: { serviceAreas: { where: { active: true } } } }, availability: {
        where: { startsAt: { lt: booking.estimatedEndAt }, endsAt: { gt: booking.scheduledAt } } },
        capabilities: { where: { serviceId: booking.serviceId } }, assignments: {
          where: { status: { in: ['OFFERED', 'ACCEPTED'] }, startsAt: { lt: booking.estimatedEndAt }, endsAt: { gt: booking.scheduledAt } },
          select: { id: true } },
      }, orderBy: { id: 'asc' } });
    const history = initial.length ? await tx.assignment.groupBy({ by: ['teamId', 'status'], where: { teamId: { in: initial.map(team => team.id) } }, _count: { _all: true } }) : [];
    const counts = (teamId: string, status: string) => history.find(row => row.teamId === teamId && row.status === status)?._count._all ?? 0;
    const slot = { startsAt: booking.scheduledAt, endsAt: booking.estimatedEndAt,
      latitude: Number(booking.locationLatitude), longitude: Number(booking.locationLongitude), serviceId: booking.serviceId };
    const excluded = new Set(previous.map(row => row.teamId));
    const decisions: CandidateDecision[] = teams.map(team => {
      const accepted = counts(team.id, 'ACCEPTED') + counts(team.id, 'COMPLETED');
      const candidate: DispatchCandidate = {
        id: team.id, companyId: team.companyId, active: team.active, companyActive: team.company.status === 'ACTIVE',
        status: team.status, capacity: team.capacity, serviceMatch: team.capabilities.length > 0,
        availability: team.availability, areas: team.company.serviceAreas.map(area => ({ latitude: Number(area.latitude), longitude: Number(area.longitude), radiusKm: Number(area.radiusKm), active: area.active })),
        latitude: team.latitude === null ? null : Number(team.latitude), longitude: team.longitude === null ? null : Number(team.longitude), locationAt: team.locationAt,
        activeWorkload: team.assignments.length, offers: counts(team.id, 'OFFERED') + counts(team.id, 'REJECTED') + counts(team.id, 'EXPIRED') + accepted,
        accepted, completed: counts(team.id, 'COMPLETED'),
      };
      const decision = evaluateCandidate(candidate, slot, this.config, now);
      if (!manual && excluded.has(team.id)) { decision.eligible = false; decision.score = null; decision.reasons.push('PREVIOUSLY_OFFERED'); }
      if (manual?.overrideAvailabilityAndArea && decision.reasons.every(reason => ['NOT_AVAILABLE', 'OUTSIDE_SERVICE_AREA', 'ETA_UNAVAILABLE'].includes(reason))) {
        decision.eligible = true; decision.reasons.push('MANUAL_OVERRIDE'); decision.score = 0;
      }
      return decision;
    });
    const selected = manual ? decisions.find(row => row.teamId === manual.teamId && row.eligible) : rankCandidates(decisions)[0];
    const snapshot = [{ policy: this.config, mode: manual ? 'MANUAL' : 'AUTOMATIC',
      reason: manual?.reason ?? null, selectedTeamId: selected?.teamId ?? null, decisions }];
    if (manual && !selected) throw new ConflictException({ code: 'MANUAL_TEAM_NOT_ELIGIBLE', decisions });
    if (!selected) return { candidates: snapshot, reason: 'NO_ELIGIBLE_CANDIDATE' };
    return { candidates: snapshot, dto: { companyId: selected.companyId, teamId: selected.teamId,
      startsAt: booking.scheduledAt.toISOString(), endsAt: booking.estimatedEndAt.toISOString(),
      expiresAt: new Date(now.getTime() + this.config.offerSeconds * 1000).toISOString(),
      reason: manual?.reason } };
  }

  async offer(actor: Actor, bookingId: string, key: string | undefined) {
    this.requireDispatcher(actor);
    return this.operationalBooking(await this.bookings.dispatchOffer(actor, bookingId, key, (tx, booking) => this.select(tx, booking)));
  }

  /** Trusted internal worker entry; never exposed as an HTTP command. */
  async systemOffer(bookingId: string) {
    return this.bookings.dispatchSystem(bookingId, (tx, booking) => this.select(tx, booking));
  }

  async manual(actor: Actor, bookingId: string, dto: ManualDispatchDto, key: string | undefined) {
    this.requireDispatcher(actor);
    return this.operationalBooking(await this.bookings.dispatchOffer(actor, bookingId, key, (tx, booking) => this.select(tx, booking, dto), true, dto));
  }

  /** Compatibility endpoint uses the same policy and operational projection as manual dispatch. */
  async legacyManual(actor: Actor, bookingId: string, dto: LegacyManualAssignmentDto, key: string | undefined) {
    this.requireDispatcher(actor);
    return this.operationalBooking(await this.bookings.dispatchOffer(actor, bookingId, key, async (tx, booking) => {
      if (new Date(dto.startsAt).getTime() !== booking.scheduledAt.getTime() || new Date(dto.endsAt).getTime() !== booking.estimatedEndAt.getTime())
        throw new ConflictException({ code: 'ASSIGNMENT_SLOT_MISMATCH' });
      const expiry = new Date(dto.expiresAt);
      if (!Number.isFinite(expiry.getTime()) || expiry <= new Date()) throw new ConflictException({ code: 'ASSIGNMENT_EXPIRY_INVALID' });
      const selection = await this.select(tx, booking, dto);
      return { ...selection, dto: selection.dto && { ...selection.dto, expiresAt: expiry.toISOString() } };
    }, true, dto));
  }

  async offers(actor: Actor) {
    const scope = assignmentScope(actor);
    const rows = await this.db.assignment.findMany({ where: { AND: [scope, { status: 'OFFERED', expiresAt: { gt: new Date() } }] },
      select: { id: true, bookingId: true, companyId: true, teamId: true, status: true, assignedAt: true, expiresAt: true, startsAt: true, endsAt: true,
        team: { select: { name: true } }, company: { select: { name: true } },
        booking: { select: { bookingNumber: true, scheduledAt: true, estimatedEndAt: true, serviceSnapshot: true,
          addressSnapshot: true, instructions: true } } }, orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }], take: 100 });
    return rows.map(({ booking, team, company, ...offer }) => {
      const service = booking.serviceSnapshot as Record<string, unknown>;
      const address = booking.addressSnapshot as Record<string, unknown>;
      return { ...offer, team: { id: offer.teamId, name: team.name }, company: { id: offer.companyId, name: company.name }, bookingNumber: booking.bookingNumber,
        service: { name: service.name, nameAr: service.nameAr, durationMinutes: service.durationMinutes },
        location: { addressText: address.addressText, latitude: address.latitude, longitude: address.longitude },
        instructions: booking.instructions };
    });
  }

  async monitoring(actor: Actor) {
    this.requireDispatcher(actor);
    const [bookings, assignments, recentAttempts] = await Promise.all([
      this.db.booking.groupBy({ by: ['status'], where: { status: { in: ['PAYMENT_CONFIRMED', 'SEARCHING_FOR_TEAM', 'TEAM_ASSIGNED', 'NO_TEAM_AVAILABLE', 'REJECTED', 'TEAM_NO_SHOW'] } }, _count: { _all: true } }),
      this.db.assignment.groupBy({ by: ['status'], where: { status: { in: ['OFFERED', 'REJECTED', 'EXPIRED', 'ACCEPTED'] } }, _count: { _all: true } }),
      this.db.dispatchAttempt.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100,
        select: { id: true, bookingId: true, sequence: true, outcome: true, reason: true, createdAt: true } }),
    ]);
    return { bookings, assignments, recentAttempts };
  }
}
