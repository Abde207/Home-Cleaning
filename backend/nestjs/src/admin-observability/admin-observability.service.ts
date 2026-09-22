import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type DeliveryStatus } from '@prisma/client';
import { PrismaService } from '../database/database.module.js';
import { hasPlatformPermission, type Actor } from '../auth/authorization.js';
import { dispatchConfig } from '../dispatch/dispatch.config.js';
import type { AdminLocationsQueryDto, AdminNotificationDeliveryQueryDto } from './admin-observability.dto.js';

function parseDate(value: string | undefined) {
  if (!value) return undefined;
  const result = new Date(value);
  if (!Number.isFinite(result.getTime())) throw new BadRequestException({ code: 'ADMIN_DATE_RANGE_INVALID' });
  return result;
}

function locationState(team: { latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null; locationAt: Date | null }, now: Date, maxAgeMinutes: number) {
  if (team.latitude === null || team.longitude === null || team.locationAt === null) return 'NEVER_REPORTED' as const;
  const fresh = team.locationAt <= now && now.getTime() - team.locationAt.getTime() <= maxAgeMinutes * 60_000;
  return fresh ? 'FRESH' as const : 'STALE' as const;
}

function safeFailure(value: string | null) {
  if (!value) return value;
  return value.replace(/(token|secret|credential|password|authorization|bearer)\s*[:=]?\s+\S+/gi, '$1=[REDACTED]').slice(0, 500);
}

@Injectable()
export class AdminObservabilityService {
  private readonly locationMaxAgeMinutes = dispatchConfig().locationMaxAgeMinutes;

  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  private notificationWhere(dto: AdminNotificationDeliveryQueryDto): Prisma.NotificationDeliveryWhereInput {
    const from = parseDate(dto.createdFrom);
    const to = parseDate(dto.createdTo);
    if (from && to && from >= to) throw new BadRequestException({ code: 'ADMIN_DATE_RANGE_INVALID' });
    return {
      ...(dto.status ? { status: dto.status as DeliveryStatus } : {}),
      ...(dto.type || dto.category || dto.userId || dto.referenceType || dto.referenceId || from || to ? {
        notification: {
          ...(dto.type ? { type: dto.type } : {}),
          ...(dto.category ? { category: dto.category } : {}),
          ...(dto.userId ? { userId: dto.userId } : {}),
          ...(dto.referenceType ? { referenceType: dto.referenceType } : {}),
          ...(dto.referenceId ? { referenceId: dto.referenceId } : {}),
          ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
        },
      } : {}),
    };
  }

  async deliveryList(dto: AdminNotificationDeliveryQueryDto) {
    const rows = await this.db.notificationDelivery.findMany({
      where: this.notificationWhere(dto),
      take: dto.limit,
      skip: dto.offset,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true, notificationId: true, status: true, channel: true, attempts: true, lastError: true,
        nextAttemptAt: true, sentAt: true, createdAt: true,
          notification: {
          select: { type: true, category: true, referenceType: true, referenceId: true, eventKey: true, userId: true, readAt: true, deliveredAt: true, createdAt: true,
            booking: { select: { id: true, bookingNumber: true } } },
        },
      },
    });
    return rows.map(row => ({ ...row, lastError: safeFailure(row.lastError) }));
  }

  async deliveryDetail(id: string) {
    const row = await this.db.notificationDelivery.findUnique({ where: { id }, select: {
      id: true, notificationId: true, status: true, channel: true, attempts: true, providerReference: true,
      lastError: true, nextAttemptAt: true, sentAt: true, createdAt: true,
      notification: { select: {
        type: true, category: true, referenceType: true, referenceId: true, eventKey: true, userId: true, readAt: true, deliveredAt: true, createdAt: true,
        booking: { select: { id: true, bookingNumber: true } },
        payload: true,
      } },
      attemptsHistory: { select: { id: true, attemptNumber: true, status: true, providerReference: true, error: true, createdAt: true }, orderBy: [{ attemptNumber: 'asc' }, { id: 'asc' }] },
    } });
    if (!row) throw new NotFoundException();
    const payload = row.notification.payload as Prisma.JsonValue;
    const safePayload = payload !== null && typeof payload === 'object' && !Array.isArray(payload) ? {
      title: typeof payload.title === 'string' ? payload.title : undefined,
      body: typeof payload.body === 'string' ? payload.body : undefined,
      data: payload.data !== null && typeof payload.data === 'object' && !Array.isArray(payload.data) ? {
        type: typeof (payload.data as Record<string, unknown>).type === 'string' ? (payload.data as Record<string, unknown>).type : undefined,
        eventId: typeof (payload.data as Record<string, unknown>).eventId === 'string' ? (payload.data as Record<string, unknown>).eventId : undefined,
        aggregateId: typeof (payload.data as Record<string, unknown>).aggregateId === 'string' ? (payload.data as Record<string, unknown>).aggregateId : undefined,
      } : undefined,
    } : {};
    const { payload: _payload, ...notification } = row.notification;
    return { ...row, lastError: safeFailure(row.lastError), notification, safePayload, attemptsHistory: row.attemptsHistory.map(attempt => ({ ...attempt, error: safeFailure(attempt.error) })) };
  }

  async locations(actor: Actor, dto: AdminLocationsQueryDto) {
    if (!hasPlatformPermission(actor, 'team:manage')) throw new ForbiddenException();
    const now = new Date();
    const staleBefore = new Date(now.getTime() - this.locationMaxAgeMinutes * 60_000);
    const base: Prisma.TeamWhereInput = {
      ...(dto.companyId ? { companyId: dto.companyId } : {}),
      ...(dto.teamId ? { id: dto.teamId } : {}),
      ...(dto.teamStatus ? { status: dto.teamStatus } : {}),
    };
    const hasLocation: Prisma.TeamWhereInput = { latitude: { not: null }, longitude: { not: null }, locationAt: { not: null } };
    if (dto.locationAvailability === 'AVAILABLE') base.AND = [...(base.AND as Prisma.TeamWhereInput[] | undefined ?? []), hasLocation];
    if (dto.locationAvailability === 'MISSING') base.AND = [...(base.AND as Prisma.TeamWhereInput[] | undefined ?? []), { OR: [{ latitude: null }, { longitude: null }, { locationAt: null }] }];
    if (dto.freshness === 'FRESH') base.AND = [...(base.AND as Prisma.TeamWhereInput[] | undefined ?? []), { ...hasLocation, locationAt: { not: null, gte: staleBefore, lte: now } }];
    if (dto.freshness === 'STALE') base.AND = [...(base.AND as Prisma.TeamWhereInput[] | undefined ?? []), { ...hasLocation, OR: [{ locationAt: { lt: staleBefore } }, { locationAt: { gt: now } }] }];
    if (dto.freshness === 'NEVER_REPORTED') base.AND = [...(base.AND as Prisma.TeamWhereInput[] | undefined ?? []), { OR: [{ latitude: null }, { longitude: null }, { locationAt: null }] }];

    const [teams, serviceAreas] = await Promise.all([
      this.db.team.findMany({ where: base, take: dto.limit, skip: dto.offset, orderBy: [{ id: 'asc' }], select: {
        id: true, name: true, internalCode: true, status: true, active: true, latitude: true, longitude: true, locationAt: true,
        company: { select: { id: true, name: true, status: true } },
      } }),
      this.db.companyServiceArea.findMany({ where: dto.companyId ? { companyId: dto.companyId } : dto.teamId ? { company: { teams: { some: { id: dto.teamId } } } } : {}, take: 100, orderBy: [{ id: 'asc' }], select: {
        id: true, name: true, latitude: true, longitude: true, radiusKm: true, active: true, company: { select: { id: true, name: true, status: true } },
      } }),
    ]);
    return {
      generatedAt: now,
      locationMaxAgeMinutes: this.locationMaxAgeMinutes,
      teams: teams.map(team => ({ ...team, freshness: locationState(team, now, this.locationMaxAgeMinutes) })),
      serviceAreas,
    };
  }
}
