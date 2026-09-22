import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

test('Phase 14B Admin read models, filtered bookings, governance redaction and read permissions', async () => {
  process.env.NODE_ENV = 'test';
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const { sessionHash } = await import('../dist/auth/authorization.js');
  const app = await createApp();
  const db = app.get(PrismaService);
  const ids: string[] = [];

  async function identity(roleName: 'HOME_CLEAN_ADMIN' | 'DISPATCHER') {
    const role = await db.role.findUniqueOrThrow({ where: { name: roleName } });
    const user = await db.user.create({ data: { phone: `+16${randomUUID().replaceAll('-', '').slice(0, 12)}`, name: `${roleName} 14B`, roles: { create: { roleId: role.id } } } });
    ids.push(user.id);
    const token = randomBytes(32).toString('base64url');
    await db.session.create({ data: { userId: user.id, accessTokenHash: sessionHash(token), refreshTokenHash: sessionHash(randomBytes(32).toString('base64url')), accessExpiresAt: new Date(Date.now() + 600_000), expiresAt: new Date(Date.now() + 1_200_000) } });
    return { user, token };
  }

  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    const get = async (path: string, token?: string) => {
      const response = await fetch(`${base}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : undefined });
      return { status: response.status, body: await response.json() as any };
    };
    const admin = await identity('HOME_CLEAN_ADMIN');
    const dispatcher = await identity('DISPATCHER');

    assert.equal((await get('/admin/dashboard')).status, 401);
    assert.equal((await get('/admin/dashboard', dispatcher.token)).status, 403);

    const customerUser = await db.user.create({ data: { phone: `+17${randomUUID().replaceAll('-', '').slice(0, 12)}`, name: '14B Customer' } });
    ids.push(customerUser.id);
    const customer = await db.customer.create({ data: { userId: customerUser.id } });
    const company = await db.company.create({ data: { internalCode: `B14-${randomUUID().slice(0, 6).toUpperCase()}`, name: '14B Company', status: 'ACTIVE', commissionRate: '0.20' } });
    const team = await db.team.create({ data: { companyId: company.id, internalCode: `B14-T-${randomUUID().slice(0, 5).toUpperCase()}`, name: '14B Team', status: 'AVAILABLE', active: true, capacity: 2 } });
    const service = await db.service.create({ data: { code: `B14_${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`, name: '14B Service', nameAr: 'خدمة 14B', description: 'read model fixture', basePrice: '10.00', durationMinutes: 60, active: true } });
    const address = await db.address.create({ data: { customerId: customer.id, label: 'Home', addressText: '14B address', latitude: 31.95, longitude: 35.91, validationStatus: 'VERIFIED' } });
    const property = await db.property.create({ data: { customerId: customer.id, type: 'APARTMENT', size: '80', rooms: 2, bathrooms: 1 } });
    const booking = await db.booking.create({ data: {
      bookingNumber: `B14-${randomUUID().slice(0, 8).toUpperCase()}`, customerId: customer.id, serviceId: service.id, propertyId: property.id, addressId: address.id,
      scheduledAt: new Date('2027-01-01T10:00:00Z'), estimatedEndAt: new Date('2027-01-01T11:00:00Z'), status: 'PAYMENT_CONFIRMED', paymentMethod: 'CASH', price: '10.00', currency: 'JOD',
      addressSnapshot: { addressText: '14B address' }, propertySnapshot: { type: 'APARTMENT' }, serviceSnapshot: { name: '14B Service', nameAr: 'خدمة 14B', durationMinutes: 60 }, locationLatitude: '31.95', locationLongitude: '35.91',
    } });
    const assignment = await db.assignment.create({ data: { bookingId: booking.id, companyId: company.id, teamId: team.id, startsAt: booking.scheduledAt, endsAt: booking.estimatedEndAt, expiresAt: new Date('2027-01-01T09:30:00Z') } });
    await db.payment.create({ data: { bookingId: booking.id, method: 'CASH', status: 'CASH_SELECTED', amount: '10.00', currency: 'JOD' } });
    const audit = await db.auditLog.create({ data: { actorUserId: admin.user.id, action: '14B_TEST_ACTION', resourceType: 'Booking', resourceId: booking.id, reason: 'fixture', requestId: '14b-test', before: { accessToken: 'secret-token', status: 'OLD', nested: { payload: { raw: 'secret' } } }, after: { code: '123456', status: 'NEW', safe: 'visible' } } });

    const dashboard = await get('/admin/dashboard', admin.token);
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.data.attention.paymentReconciliation, 0);
    assert.ok(dashboard.body.data.finance.cashExpected >= 1);
    assert.ok(Array.isArray(dashboard.body.data.bookingsByStatus));
    assert.equal(dashboard.body.data.recentDispatchAttempts instanceof Array, true);

    const bookings = await get(`/admin/bookings?bookingNumber=${booking.bookingNumber.slice(0, 10)}&status=PAYMENT_CONFIRMED`, admin.token);
    assert.equal(bookings.status, 200);
    assert.equal(bookings.body.data.length, 1);
    assert.equal(bookings.body.data[0].id, booking.id);
    assert.equal(bookings.body.data[0].customer.phone, customerUser.phone);
    assert.equal(bookings.body.data[0].currentAssignment.company.name, company.name);
    assert.equal(bookings.body.data[0].payment.status, 'CASH_SELECTED');
    assert.equal('addressSnapshot' in bookings.body.data[0], false);
    assert.equal((await get(`/admin/bookings?companyId=${randomUUID()}&teamId=${team.id}`, admin.token)).status, 400);

    const auditList = await get('/admin/audit-logs?action=14B_TEST_ACTION', admin.token);
    assert.equal(auditList.status, 200);
    assert.equal(auditList.body.data.length, 1);
    assert.equal('before' in auditList.body.data[0], false);
    const auditDetail = await get(`/admin/audit-logs/${audit.id}`, admin.token);
    assert.equal(auditDetail.status, 200);
    assert.equal(auditDetail.body.data.before.accessToken, '[REDACTED]');
    assert.equal(auditDetail.body.data.before.nested.payload, '[REDACTED]');
    assert.equal(auditDetail.body.data.after.code, '[REDACTED]');
    assert.equal(auditDetail.body.data.after.safe, 'visible');

    assert.equal((await get('/admin/users', admin.token)).status, 200);
    assert.equal((await get(`/admin/users/${admin.user.id}/roles`, admin.token)).status, 200);
    assert.equal((await get('/admin/users', dispatcher.token)).status, 403);
  } finally {
    await app.close();
  }
});
