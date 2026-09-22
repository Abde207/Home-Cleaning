import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

test('Phase 14G Admin notification delivery and stored-location projections are private, filtered and read-only', async () => {
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const { sessionHash } = await import('../dist/auth/authorization.js');
  const app = await createApp();
  const db = app.get(PrismaService);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    async function identity(roleName: 'HOME_CLEAN_ADMIN' | 'CUSTOMER') {
      const role = await db.role.findUniqueOrThrow({ where: { name: roleName } });
      const user = await db.user.create({ data: { phone: `+96279${suffix}${randomUUID().replaceAll('-', '').slice(0, 3)}`.slice(0, 20), name: roleName === 'CUSTOMER' ? 'Recipient' : 'Admin', customer: { create: {} }, roles: { create: { roleId: role.id } } } });
      const token = randomBytes(32).toString('base64url');
      await db.session.create({ data: { userId: user.id, accessTokenHash: sessionHash(token), refreshTokenHash: sessionHash(randomBytes(32).toString('hex')), accessExpiresAt: new Date(Date.now() + 600000), expiresAt: new Date(Date.now() + 1200000) } });
      return { user, token };
    }
    async function request(path: string, token: string) {
      const response = await fetch(`${base}${path}`, { headers: { authorization: `Bearer ${token}` } });
      return { status: response.status, body: await response.json() as any };
    }

    const admin = await identity('HOME_CLEAN_ADMIN');
    const recipient = await identity('CUSTOMER');
    const company = await db.company.create({ data: { internalCode: `G-C-${suffix}`, name: 'Observability Company', status: 'ACTIVE', commissionRate: '0.20' } });
    const freshTeam = await db.team.create({ data: { companyId: company.id, internalCode: `G-T1-${suffix}`, name: 'Fresh Team', status: 'AVAILABLE', active: true, latitude: '31.9500000', longitude: '35.9100000', locationAt: new Date(Date.now() - 5 * 60_000) } });
    await db.team.create({ data: { companyId: company.id, internalCode: `G-T2-${suffix}`, name: 'Stale Team', status: 'PAUSED', active: true, latitude: '31.9600000', longitude: '35.9200000', locationAt: new Date(Date.now() - 300 * 60_000) } });
    await db.team.create({ data: { companyId: company.id, internalCode: `G-T3-${suffix}`, name: 'Never Team', status: 'OFFLINE', active: true } });
    await db.companyServiceArea.create({ data: { companyId: company.id, name: 'Amman', latitude: '31.9500000', longitude: '35.9100000', radiusKm: '10.000', active: true } });

    const device = await db.deviceToken.create({ data: { userId: recipient.user.id, token: `sensitive-device-token-${suffix}`, platform: 'android' } });
    const notification = await db.notification.create({ data: { userId: recipient.user.id, type: 'BOOKING_CREATED', category: 'TRANSACTIONAL', referenceType: 'BOOKING', referenceId: randomUUID(), eventKey: `${randomUUID()}:${recipient.user.id}`, payload: { title: 'Booking created', body: 'A booking was created', data: { type: 'BOOKING_CREATED', eventId: randomUUID(), aggregateId: randomUUID(), secret: 'must-not-leak' }, password: 'must-not-leak' } } });
    const delivery = await db.notificationDelivery.create({ data: { notificationId: notification.id, deviceTokenId: device.id, status: 'FAILED', channel: 'PUSH', attempts: 2, providerReference: 'mock-reference', lastError: 'Temporary provider failure' } });
    await db.notificationDeliveryAttempt.createMany({ data: [
      { deliveryId: delivery.id, attemptNumber: 1, status: 'PENDING', error: 'Temporary provider failure' },
      { deliveryId: delivery.id, attemptNumber: 2, status: 'FAILED', providerReference: 'mock-reference', error: 'Temporary provider failure' },
    ] });

    const failed = await request(`/admin/notification-deliveries?status=FAILED&type=BOOKING_CREATED&userId=${recipient.user.id}`, admin.token);
    assert.equal(failed.status, 200, JSON.stringify(failed.body));
    assert.equal(failed.body.data.length, 1);
    assert.equal(failed.body.data[0].notification.userId, recipient.user.id);
    assert.equal(failed.body.data[0].lastError, 'Temporary provider failure');
    assert.equal('payload' in failed.body.data[0], false);
    assert.equal('deviceToken' in failed.body.data[0], false);

    const detail = await request(`/admin/notification-deliveries/${delivery.id}`, admin.token);
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.equal(detail.body.data.safePayload.title, 'Booking created');
    assert.equal(detail.body.data.safePayload.body, 'A booking was created');
    assert.equal(detail.body.data.safePayload.data.type, 'BOOKING_CREATED');
    assert.equal('secret' in detail.body.data.safePayload.data, false);
    assert.equal(JSON.stringify(detail.body.data).includes('must-not-leak'), false);
    assert.equal(JSON.stringify(detail.body.data).includes('sensitive-device-token'), false);
    assert.equal(detail.body.data.attemptsHistory.length, 2);

    const locations = await request('/admin/operations/locations?companyId=' + company.id, admin.token);
    assert.equal(locations.status, 200, JSON.stringify(locations.body));
    assert.equal(locations.body.data.teams.length, 3);
    assert.equal(locations.body.data.teams.find((row: any) => row.id === freshTeam.id).freshness, 'FRESH');
    assert.equal(locations.body.data.teams.some((row: any) => row.freshness === 'STALE'), true);
    assert.equal(locations.body.data.teams.some((row: any) => row.freshness === 'NEVER_REPORTED'), true);
    assert.equal(locations.body.data.serviceAreas.length, 1);
    assert.equal((await request('/admin/operations/locations?freshness=FRESH', admin.token)).body.data.teams.length >= 1, true);
    assert.equal((await request('/admin/operations/locations?freshness=NEVER_REPORTED', admin.token)).body.data.teams.length, 1);

    assert.equal((await request('/admin/notification-deliveries', recipient.token)).status, 403);
    assert.equal((await request('/admin/operations/locations', recipient.token)).status, 403);
    assert.equal((await request(`/admin/notification-deliveries/${randomUUID()}`, admin.token)).status, 404);
    assert.equal((await db.notificationDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).attempts, 2);
  } finally { await app.close(); }
});
