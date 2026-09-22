import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type DeliveryStatus } from '@prisma/client';
import { PrismaService } from '../database/database.module.js';
import type { Actor } from '../auth/authorization.js';
import type { ListQueryDto } from '../core/core.dto.js';
import { InvalidPushTokenError, type PushNotificationProvider } from './notification.provider.js';
import type { DeviceTokenDto } from './notification.dto.js';

export const PUSH_NOTIFICATION_PROVIDER = 'PUSH_NOTIFICATION_PROVIDER';
type Outbox = { id: string; type: string; aggregateId: string; payload: Prisma.JsonValue; attempts: number };
const MAX_DELIVERY_ATTEMPTS = 5;

function jsonValue(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
function permission(actor: Actor, code: string) { return actor.scopes.some(scope => scope.permissions.includes(code)); }

@Injectable()
export class NotificationService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(PUSH_NOTIFICATION_PROVIDER) private readonly push: PushNotificationProvider) {}

  list(actor: Actor, page: ListQueryDto = { limit: 100, offset: 0 }) {
    return this.db.notification.findMany({ where: { userId: actor.userId }, select: { id: true, type: true, category: true, referenceType: true, referenceId: true, payload: true, readAt: true, deliveredAt: true, createdAt: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: page.limit, skip: page.offset });
  }

  async read(actor: Actor, id: string) {
    const result = await this.db.notification.updateMany({ where: { id, userId: actor.userId, readAt: null }, data: { readAt: new Date() } });
    if (!result.count) {
      const found = await this.db.notification.findFirst({ where: { id, userId: actor.userId }, select: { id: true, readAt: true } });
      if (!found) throw new NotFoundException();
      return { id: found.id, readAt: found.readAt };
    }
    return this.db.notification.findUniqueOrThrow({ where: { id }, select: { id: true, readAt: true } });
  }

  async registerDevice(actor: Actor, dto: DeviceTokenDto) {
    const existing = await this.db.deviceToken.findUnique({ where: { token: dto.token } });
    if (existing && existing.userId !== actor.userId) throw new ConflictException({ code: 'DEVICE_TOKEN_OWNED_BY_OTHER_USER' });
    if (existing) return this.db.deviceToken.update({ where: { id: existing.id }, data: { platform: dto.platform, active: true, invalidatedAt: null, lastSeenAt: new Date() }, select: { id: true, platform: true, active: true, lastSeenAt: true } });
    return this.db.deviceToken.create({ data: { userId: actor.userId, token: dto.token, platform: dto.platform }, select: { id: true, platform: true, active: true, lastSeenAt: true } });
  }

  async unregisterDevice(actor: Actor, id: string) {
    const result = await this.db.deviceToken.updateMany({ where: { id, userId: actor.userId }, data: { active: false, invalidatedAt: new Date() } });
    if (!result.count) throw new NotFoundException();
    return { inactive: true };
  }

  private async recipients(tx: Prisma.TransactionClient, event: Outbox) {
    const payload = event.payload as Record<string, Prisma.JsonValue>;
    const userIds = new Set<string>();
    const addCustomer = async (bookingId: string | undefined) => {
      if (!bookingId) return;
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { customer: { select: { userId: true } } } });
      if (booking) userIds.add(booking.customer.userId);
    };
    if (event.type === 'ASSIGNMENT_OFFERED') {
      const teamId = typeof payload.teamId === 'string' ? payload.teamId : undefined;
      if (teamId) (await tx.teamMember.findMany({ where: { teamId, active: true, user: { status: 'ACTIVE' } }, select: { userId: true } })).forEach(row => userIds.add(row.userId));
    } else if (event.type === 'SETTLEMENT_STATUS_CHANGED') {
      const settlementId = typeof payload.settlementId === 'string' ? payload.settlementId : undefined;
      const settlement = settlementId ? await tx.settlement.findUnique({ where: { id: settlementId }, select: { companyId: true } }) : null;
      if (settlement) {
        (await tx.userRole.findMany({ where: { OR: [{ companyId: settlement.companyId }, { role: { name: 'HOME_CLEAN_ADMIN' } }] }, select: { userId: true } })).forEach(row => userIds.add(row.userId));
      }
    } else if (event.type === 'DISPATCH_NO_TEAM_AVAILABLE' || event.type.startsWith('BOOKING_') || event.type.startsWith('PAYMENT_') || event.type.startsWith('REFUND_') || event.type === 'CASH_COLLECTED') {
      const bookingId = typeof payload.bookingId === 'string' ? payload.bookingId : undefined;
      if (bookingId) await addCustomer(bookingId); else if (typeof payload.paymentId === 'string') {
        const payment = await tx.payment.findUnique({ where: { id: payload.paymentId }, select: { booking: { select: { customer: { select: { userId: true } } } } } });
        if (payment) userIds.add(payment.booking.customer.userId);
      }
    }
    return [...userIds];
  }

  private message(event: Outbox) {
    const payload = event.payload as Record<string, Prisma.JsonValue>;
    const status = typeof payload.newStatus === 'string' ? `: ${payload.newStatus}` : '';
    const title = event.type.replaceAll('_', ' ');
    return { title, body: `${title}${status}`, data: { eventId: event.id, type: event.type, aggregateId: event.aggregateId } };
  }

  async processOutboxOnce(limit = 100) {
    const ids = await this.db.$queryRaw<{ id: string }[]>`SELECT id FROM "OutboxEvent" WHERE "processedAt" IS NULL ORDER BY "createdAt", id FOR UPDATE SKIP LOCKED LIMIT ${limit}`;
    let created = 0;
    for (const row of ids) {
      await this.db.$transaction(async tx => {
        const event = await tx.outboxEvent.findUnique({ where: { id: row.id } });
        if (!event || event.processedAt) return;
        const recipients = await this.recipients(tx, event as Outbox);
        const message = this.message(event as Outbox);
        for (const userId of recipients) {
          const tokens = await tx.deviceToken.findMany({ where: { userId, active: true }, select: { id: true } });
          try {
            await tx.notification.create({ data: { userId, bookingId: typeof (event.payload as any).bookingId === 'string' ? (event.payload as any).bookingId : undefined, type: event.type, category: event.type.startsWith('SETTLEMENT') ? 'OPERATIONAL' : 'TRANSACTIONAL', referenceType: 'OUTBOX_EVENT', referenceId: event.aggregateId, eventKey: `${event.id}:${userId}`, payload: jsonValue({ ...message, payload: event.payload }), deliveries: { create: tokens.map(token => ({ channel: 'PUSH', deviceTokenId: token.id })) } } });
            created++;
          } catch (error) {
            if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
          }
        }
        await tx.outboxEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), attempts: { increment: 1 } } });
      });
    }
    return { processed: ids.length, created };
  }

  private async claim(id: string) {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "NotificationDelivery" WHERE id = ${id}::uuid FOR UPDATE`;
      const row = await tx.notificationDelivery.findUnique({ where: { id }, include: { notification: true, deviceToken: true } });
      if (!row || row.status !== 'PENDING') return null;
      if (!row.deviceToken?.active) {
        await tx.notificationDelivery.update({ where: { id }, data: { status: 'FAILED', lastError: 'DEVICE_TOKEN_INACTIVE' } });
        return null;
      }
      const attemptNumber = row.attempts + 1;
      await tx.notificationDelivery.update({ where: { id }, data: { status: 'SENDING', attempts: attemptNumber } });
      return { ...row, attemptNumber };
    });
  }

  async processDeliveriesOnce(limit = 100) {
    const rows = await this.db.notificationDelivery.findMany({ where: { status: 'PENDING', OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] }, select: { id: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: limit });
    let sent = 0, failed = 0, retried = 0;
    for (const row of rows) {
      const claimed = await this.claim(row.id);
      if (!claimed || !claimed.deviceToken) continue;
      const payload = claimed.notification.payload as Record<string, any>;
      try {
        const result = await this.push.send({ token: claimed.deviceToken.token, title: String(payload.title ?? 'Home Clean'), body: String(payload.body ?? ''), data: (payload.data ?? {}) as Record<string, string> });
        await this.db.$transaction(async tx => {
          await tx.notificationDelivery.update({ where: { id: row.id }, data: { status: 'SENT', providerReference: result.providerReference, sentAt: new Date(), nextAttemptAt: null, lastError: null } });
          await tx.notificationDeliveryAttempt.create({ data: { deliveryId: row.id, attemptNumber: claimed.attemptNumber, status: 'SENT', providerReference: result.providerReference } });
          await tx.notification.update({ where: { id: claimed.notificationId }, data: { deliveredAt: new Date() } });
        });
        sent++;
      } catch (error) {
        const invalid = error instanceof InvalidPushTokenError;
        const terminal = invalid || claimed.attemptNumber >= MAX_DELIVERY_ATTEMPTS;
        await this.db.$transaction(async tx => {
          await tx.notificationDelivery.update({ where: { id: row.id }, data: { status: terminal ? 'FAILED' : 'PENDING', nextAttemptAt: terminal ? null : new Date(Date.now() + 2 ** claimed.attemptNumber * 1000), lastError: error instanceof Error ? error.message : String(error) } });
          await tx.notificationDeliveryAttempt.create({ data: { deliveryId: row.id, attemptNumber: claimed.attemptNumber, status: terminal ? 'FAILED' : 'PENDING', error: error instanceof Error ? error.message : String(error) } });
          if (invalid && claimed.deviceTokenId) await tx.deviceToken.update({ where: { id: claimed.deviceTokenId }, data: { active: false, invalidatedAt: new Date() } });
        });
        if (terminal) failed++; else retried++;
      }
    }
    return { processed: rows.length, sent, failed, retried };
  }
}
