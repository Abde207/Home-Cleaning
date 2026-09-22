import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

test('Phase 11 location ownership/defaults/geocoding and notification delivery are isolated and idempotent', async () => {
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const { sessionHash } = await import('../dist/auth/authorization.js');
  const { NotificationService } = await import('../dist/notifications/notification.service.js');
  const app = await createApp();
  const db = app.get(PrismaService);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    async function identity(roleName: string) {
      const role = await db.role.findUniqueOrThrow({ where: { name: roleName as any } });
      const user = await db.user.create({ data: { phone: `+96279${suffix}${randomUUID().replaceAll('-', '').slice(0, 3)}`.slice(0, 20), customer: { create: {} }, roles: { create: { roleId: role.id } } } });
      const token = randomBytes(32).toString('base64url');
      await db.session.create({ data: { userId: user.id, accessTokenHash: sessionHash(token), refreshTokenHash: sessionHash(randomBytes(32).toString('hex')), accessExpiresAt: new Date(Date.now() + 600000), expiresAt: new Date(Date.now() + 1200000) } });
      return { user, token, customer: await db.customer.findUniqueOrThrow({ where: { userId: user.id } }) };
    }
    async function request(method: string, path: string, token: string, body?: unknown) {
      const response = await fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(method === 'POST' && path === '/bookings' ? { 'Idempotency-Key': `phase11-${randomUUID()}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() as any };
    }
    const customer = await identity('CUSTOMER');
    const other = await identity('CUSTOMER');
    const customerToken = await request('POST', '/devices', customer.token, { token: `valid-${suffix}-device-001`, platform: 'android' });
    assert.equal(customerToken.status, 201);

    const first = await request('POST', '/customers/me/addresses', customer.token, { label: 'Home', addressText: 'Amman, Jordan' });
    assert.equal(first.status, 201);
    assert.equal(first.body.data.isDefault, true);
    assert.equal(first.body.data.validationStatus, 'VERIFIED');
    assert.equal(typeof first.body.data.latitude, 'string');
    assert.equal((await request('POST', '/customers/me/addresses', other.token, { label: 'Foreign', addressText: 'Other' })).status, 201);
    assert.equal((await request('PUT', `/customers/me/addresses/${first.body.data.id}`, other.token, { label: 'Hijack', addressText: 'Other', latitude: 31.9, longitude: 35.9 })).status, 404);
    assert.equal((await request('POST', '/customers/me/addresses', customer.token, { label: 'Bad', addressText: 'Invalid', latitude: 91, longitude: 35 })).status, 400);

    const defaults = await Promise.all([1, 2].map(index => request('POST', '/customers/me/addresses', customer.token, { label: `Concurrent ${index}`, addressText: `Amman ${index}`, isDefault: true })));
    assert.deepEqual(defaults.map(result => result.status).sort(), [201, 201]);
    assert.equal(await db.address.count({ where: { customerId: customer.customer.id, isDefault: true, archivedAt: null } }), 1);
    assert.equal((await request('GET', '/customers/me/addresses', other.token)).body.data.some((row: any) => row.id === first.body.data.id), false);

    const service = await db.service.create({ data: { code: `P11_${suffix}`, name: 'Phase 11', nameAr: 'المرحلة 11', basePrice: '20.00', durationMinutes: 60, active: true } });
    const property = await db.property.create({ data: { customerId: customer.customer.id, type: 'APARTMENT', size: '80.00', rooms: 2, bathrooms: 1 } });
    const booking = await request('POST', '/bookings', customer.token, { serviceId: service.id, propertyId: property.id, addressId: first.body.data.id, scheduledAt: '2027-08-01T10:00:00Z', extras: [] });
    assert.equal(booking.status, 201, JSON.stringify(booking.body));
    const notifications = app.get(NotificationService);
    assert.equal((await notifications.processOutboxOnce()).processed >= 1, true);
    assert.equal((await notifications.processOutboxOnce()).created, 0);
    const own = await request('GET', '/notifications', customer.token);
    assert.equal(own.status, 200);
    assert.equal(own.body.data.some((row: any) => row.referenceId === booking.body.data.id), true);
    assert.equal((await request('GET', '/notifications', other.token)).body.data.length, 0);
    const notification = own.body.data.find((row: any) => row.referenceId === booking.body.data.id);
    assert.equal((await request('PATCH', `/notifications/${notification.id}/read`, customer.token, { reason: 'TEST' })).status, 200);
    assert.notEqual((await db.notification.findUniqueOrThrow({ where: { id: notification.id } })).readAt, null);
    assert.equal((await notifications.processDeliveriesOnce()).sent >= 1, true);
    assert.equal((await db.notification.findUniqueOrThrow({ where: { id: notification.id } })).deliveredAt !== null, true);

    const invalidDevice = await request('POST', '/devices', customer.token, { token: `invalid-${suffix}-device-001`, platform: 'web' });
    assert.equal(invalidDevice.status, 201);
    const retryDevice = await request('POST', '/devices', customer.token, { token: `retry-${suffix}-device-001`, platform: 'web' });
    assert.equal(retryDevice.status, 201);
    const failedBooking = await request('POST', '/bookings', customer.token, { serviceId: service.id, propertyId: property.id, addressId: first.body.data.id, scheduledAt: '2027-08-02T10:00:00Z', extras: [] });
    await notifications.processOutboxOnce();
    const deliveryResult = await notifications.processDeliveriesOnce();
    assert.equal(deliveryResult.retried >= 1, true);
    assert.equal(await db.notificationDelivery.count({ where: { deviceTokenId: retryDevice.body.data.id, status: 'PENDING', attempts: 1 } }), 1);
    await db.notificationDelivery.updateMany({ where: { deviceTokenId: retryDevice.body.data.id }, data: { nextAttemptAt: new Date(0) } });
    assert.equal((await notifications.processDeliveriesOnce()).retried >= 1, true);
    assert.equal(await db.deviceToken.count({ where: { userId: customer.user.id, token: `invalid-${suffix}-device-001`, active: false } }), 1);
    assert.equal(failedBooking.status, 201);
  } finally { await app.close(); }
});
