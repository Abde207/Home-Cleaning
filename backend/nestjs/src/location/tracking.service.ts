import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/database.module.js';
import type { Actor } from '../auth/authorization.js';
import type { TeamLocationDto } from './tracking.dto.js';
import { ROUTING_PROVIDER, type RoutingProvider } from './location.provider.js';

export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radians = Math.PI / 180;
  const x = (b.longitude - a.longitude) * radians * Math.cos(((a.latitude + b.latitude) / 2) * radians);
  const y = (b.latitude - a.latitude) * radians;
  return Math.sqrt(x * x + y * y) * 6371000;
}

@Injectable()
export class TrackingService {
  constructor(private readonly db: PrismaService, @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(ROUTING_PROVIDER) private readonly routing: RoutingProvider) {}
  async update(actor: Actor, assignmentId: string, point: TeamLocationDto) {
    const assignment = await this.db.assignment.findUnique({ where: { id: assignmentId },
      include: { booking: { select: { id: true, status: true, locationLatitude: true, locationLongitude: true, scheduledAt: true } } } });
    if (!assignment) throw new NotFoundException();
    const allowed = actor.scopes.some(scope => scope.role === 'TEAM_LEADER_CLEANER' && scope.companyId === assignment.companyId &&
      scope.teamId === assignment.teamId && scope.permissions.includes('assignment:team'));
    if (!allowed) throw new NotFoundException();
    if (assignment.status !== 'ACCEPTED' || assignment.booking.status !== 'TEAM_ON_THE_WAY') throw new ForbiddenException({ code: 'TRACKING_NOT_ACTIVE' });
    const radius = Number(this.config.get('ARRIVAL_GEOFENCE_METERS') ?? 100);
    const arrived = assignment.booking.locationLatitude !== null && assignment.booking.locationLongitude !== null &&
      distanceMeters(point, { latitude: Number(assignment.booking.locationLatitude), longitude: Number(assignment.booking.locationLongitude) }) <= radius;
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Assignment" WHERE id = ${assignmentId}::uuid FOR UPDATE`;
      const current = await tx.assignment.findUnique({ where: { id: assignmentId }, select: { status: true, booking: { select: { status: true } } } });
      if (current?.status !== 'ACCEPTED' || current.booking.status !== 'TEAM_ON_THE_WAY') throw new ForbiddenException({ code: 'TRACKING_NOT_ACTIVE' });
      await tx.team.update({ where: { id: assignment.teamId }, data: { latitude: point.latitude, longitude: point.longitude, locationAt: new Date() } });
      if (arrived) {
        if (!await tx.assignmentEvent.findFirst({ where: { assignmentId, type: 'GPS_ARRIVED' } })) {
          const at = new Date();
          await tx.assignmentEvent.create({ data: { assignmentId, type: 'GPS_ARRIVED', metadata: {
            targetArrival: assignment.booking.scheduledAt.toISOString(), actualArrival: at.toISOString(),
            delaySeconds: Math.max(0, Math.floor((at.getTime() - assignment.booking.scheduledAt.getTime()) / 1000)),
          } } });
        }
      }
    });
    return { accepted: true, arrived };
  }

  async current(actor: Actor, bookingId: string) {
    const customer = await this.db.customer.findUnique({ where: { userId: actor.userId }, select: { id: true } });
    if (!customer) throw new NotFoundException();
    const booking = await this.db.booking.findFirst({ where: { id: bookingId, customerId: customer.id },
      select: { status: true, locationLatitude: true, locationLongitude: true,
        assignments: { where: { status: 'ACCEPTED' }, take: 1, orderBy: { assignedAt: 'desc' },
        select: { id: true, assignedAt: true, acceptedAt: true, team: { select: { latitude: true, longitude: true, locationAt: true } } } },
        history: { where: { newStatus: 'TEAM_ON_THE_WAY' }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } } } });
    if (!booking) throw new NotFoundException();
    if (booking.status !== 'TEAM_ON_THE_WAY') return { active: false, location: null, etaSeconds: null };
    const assignment = booking.assignments[0];
    const started = booking.history[0]?.createdAt;
    const team = assignment?.team;
    const assignmentStarted = assignment?.acceptedAt ?? assignment?.assignedAt;
    const visibleAfter = started && assignmentStarted && started > assignmentStarted ? started : assignmentStarted ?? started;
    if (!team?.locationAt || !visibleAfter || team.locationAt < visibleAfter || team.latitude === null || team.longitude === null)
      return { active: true, location: null, etaSeconds: null };
    const ageSeconds = Math.max(0, Math.floor((Date.now() - team.locationAt.getTime()) / 1000));
    const stale = ageSeconds > Number(this.config.get('TRACKING_STALE_SECONDS') ?? 120);
    let etaSeconds: number | null = null;
    try {
      etaSeconds = await this.routing.etaSeconds({ latitude: Number(team.latitude), longitude: Number(team.longitude) },
        { latitude: Number(booking.locationLatitude), longitude: Number(booking.locationLongitude) });
      if (etaSeconds !== null && (!Number.isInteger(etaSeconds) || etaSeconds < 0 || etaSeconds > 86400)) etaSeconds = null;
    } catch { etaSeconds = null; }
    return { active: true, location: { latitude: Number(team.latitude), longitude: Number(team.longitude), updatedAt: team.locationAt,
      stale }, etaSeconds, etaStale: stale, etaUnavailable: etaSeconds === null };
  }
}
