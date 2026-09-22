import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

test('notification lease recovery is exclusive, bounded and redacts provider failures', async () => {
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const { NotificationService } = await import('../dist/notifications/notification.service.js');
  const app = await createApp();
  try {
    await app.init();
    const db = app.get(PrismaService);
    const user = await db.user.create({ data: { phone: `+96279${randomUUID().replaceAll('-', '').slice(0, 9)}` } });
    const device = await db.deviceToken.create({ data: { userId: user.id, token: `recovery-${randomUUID()}`, platform: 'android' } });
    const notification = await db.notification.create({ data: { userId: user.id, type: 'RECOVERY_TEST', payload: { title: 'Test', body: 'Test', data: {} } } });
    const delivery = await db.notificationDelivery.create({ data: { notificationId: notification.id, deviceTokenId: device.id,
      channel: 'PUSH', status: 'SENDING', attempts: 1, nextAttemptAt: new Date(0) } });
    let sends = 0;
    const push = { name: 'test', async send() { sends++; await new Promise(resolve => setTimeout(resolve, 20)); return { providerReference: 'test-reference' }; } };
    const first = new NotificationService(db, push);
    const second = new NotificationService(db, push);
    await Promise.all([first.processDeliveriesOnce(), second.processDeliveriesOnce()]);
    assert.equal(sends, 1);
    assert.equal((await db.notificationDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).status, 'SENT');
    assert.deepEqual((await db.notificationDeliveryAttempt.findMany({ where: { deliveryId: delivery.id }, orderBy: { attemptNumber: 'asc' } })).map(row => [row.attemptNumber, row.status]), [[1, 'FAILED'], [2, 'SENT']]);
    await first.processDeliveriesOnce();
    assert.equal(sends, 1);

    const exhausted = await db.notificationDelivery.create({ data: { notificationId: notification.id, deviceTokenId: device.id,
      channel: 'PUSH', status: 'SENDING', attempts: 5, nextAttemptAt: new Date(0) } });
    await second.processDeliveriesOnce();
    assert.equal(sends, 1);
    const exhaustedRow = await db.notificationDelivery.findUniqueOrThrow({ where: { id: exhausted.id } });
    assert.equal(exhaustedRow.status, 'FAILED');
    assert.equal(exhaustedRow.lastError, 'DELIVERY_LEASE_EXPIRED');

    const failing = new NotificationService(db, { name: 'test', async send() { throw new Error('secret-looking-provider-detail'); } });
    const failed = await db.notificationDelivery.create({ data: { notificationId: notification.id, deviceTokenId: device.id, channel: 'PUSH' } });
    await failing.processDeliveriesOnce();
    const failedRow = await db.notificationDelivery.findUniqueOrThrow({ where: { id: failed.id } });
    assert.equal(failedRow.status, 'PENDING');
    assert.equal(failedRow.lastError, 'PUSH_DELIVERY_FAILED');
    assert.equal((await db.notificationDeliveryAttempt.findFirstOrThrow({ where: { deliveryId: failed.id } })).error, 'PUSH_DELIVERY_FAILED');

    const event = await db.outboxEvent.create({ data: { type: 'UNROUTED_TEST', aggregateId: randomUUID(), payload: {} } });
    const [one, two] = await Promise.all([first.processOutboxOnce(), second.processOutboxOnce()]);
    assert.equal(one.processed + two.processed, 1);
    assert.equal((await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).attempts, 1);

    const poison = await db.outboxEvent.create({ data: { type: 'BOOKING_STATUS_CHANGED', aggregateId: randomUUID(), payload: { bookingId: 'invalid-uuid' } } });
    for (let attempt = 1; attempt <= 5; attempt++) {
      assert.equal((await first.processOutboxOnce()).failed, 1);
      assert.equal((await db.outboxEvent.findUniqueOrThrow({ where: { id: poison.id } })).attempts, attempt);
    }
    assert.equal((await second.processOutboxOnce()).failed, 0);
    assert.equal((await db.outboxEvent.findUniqueOrThrow({ where: { id: poison.id } })).processedAt, null);
  } finally { await app.close(); }
});
