import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

test('Phase 14E Admin booking investigation and dispatch commands preserve policy, locks, idempotency and audit', async () => {
  process.env.NODE_ENV = 'test';
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const { sessionHash } = await import('../dist/auth/authorization.js');
  const app = await createApp();
  const db = app.get(PrismaService);

  async function identity(roleName: 'HOME_CLEAN_ADMIN' | 'DISPATCHER', label: string) {
    const role = await db.role.findUniqueOrThrow({ where: { name: roleName } });
    const user = await db.user.create({ data: { phone: `+19${randomUUID().replaceAll('-', '').slice(0, 12)}`, name: label, roles: { create: { roleId: role.id } } } });
    const token = randomBytes(32).toString('base64url');
    await db.session.create({ data: { userId: user.id, accessTokenHash: sessionHash(token), refreshTokenHash: sessionHash(randomBytes(32).toString('base64url')), accessExpiresAt: new Date(Date.now() + 600_000), expiresAt: new Date(Date.now() + 1_200_000) } });
    return { user, token };
  }

  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    async function request(method: string, path: string, token: string, body?: unknown, key?: string) {
      const response = await fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() as any };
    }

    const admin = await identity('HOME_CLEAN_ADMIN', '14E Admin');
    const dispatcher = await identity('DISPATCHER', '14E Dispatcher');
    const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
    const customerUser = await db.user.create({ data: { phone: `+20${randomUUID().replaceAll('-', '').slice(0, 12)}`, name: '14E Customer' } });
    const customer = await db.customer.create({ data: { userId: customerUser.id } });
    const address = await db.address.create({ data: { customerId: customer.id, label: 'Home', addressText: '14E address', latitude: 31.95, longitude: 35.91, validationStatus: 'VERIFIED' } });
    const property = await db.property.create({ data: { customerId: customer.id, type: 'APARTMENT', size: '80', rooms: 2, bathrooms: 1 } });
    const service = await db.service.create({ data: { code: `E14_SERVICE_${suffix}`, name: '14E service', nameAr: 'خدمة 14E', description: 'dispatch fixture', basePrice: '20.00', durationMinutes: 60, active: true } });
    const company = await db.company.create({ data: { internalCode: `E14-C-${suffix}`, name: '14E company', status: 'ACTIVE', commissionRate: '0.2000' } });
    const team = await db.team.create({ data: { companyId: company.id, internalCode: `E14-T-${suffix}`, name: '14E team', status: 'AVAILABLE', active: true, capacity: 2 } });
    await db.companyServiceArea.create({ data: { companyId: company.id, name: 'Amman', latitude: 31.95, longitude: 35.91, radiusKm: '10.000', active: true } });
    await db.teamAvailability.create({ data: { teamId: team.id, startsAt: new Date('2027-01-01T09:00:00Z'), endsAt: new Date('2027-01-01T12:00:00Z'), available: true } });
    await db.teamServiceCapability.create({ data: { teamId: team.id, serviceId: service.id } });
    const booking = await db.booking.create({ data: {
      bookingNumber: `E14-${suffix}`, customerId: customer.id, serviceId: service.id, propertyId: property.id, addressId: address.id,
      scheduledAt: new Date('2027-01-01T10:00:00Z'), estimatedEndAt: new Date('2027-01-01T11:00:00Z'), status: 'PAYMENT_CONFIRMED', paymentMethod: 'CASH', price: '20.00', currency: 'JOD',
      addressSnapshot: { addressText: '14E address' }, propertySnapshot: { type: 'APARTMENT' }, serviceSnapshot: { name: '14E service', nameAr: 'خدمة 14E', durationMinutes: 60 }, locationLatitude: '31.95', locationLongitude: '35.91',
    } });

    assert.equal((await request('GET', `/admin/bookings/${booking.id}`, admin.token)).status, 200);
    assert.equal((await request('GET', `/admin/bookings/${booking.id}`, dispatcher.token)).status, 403);

    const manualBody = { companyId: company.id, teamId: team.id, reason: '14E manual dispatch investigation' };
    const offered = await request('POST', `/dispatch/bookings/${booking.id}/manual`, admin.token, manualBody, '14e-manual-offer');
    assert.equal(offered.status, 200);
    assert.equal(offered.body.data.status, 'TEAM_ASSIGNED');
    const assignmentId = offered.body.data.assignments[0].id;
    const replay = await request('POST', `/dispatch/bookings/${booking.id}/manual`, admin.token, manualBody, '14e-manual-offer');
    assert.equal(replay.status, 200);
    assert.equal(replay.body.data.assignments[0].id, assignmentId);
    assert.equal((await request('POST', `/dispatch/bookings/${booking.id}/manual`, admin.token, { ...manualBody, reason: 'different' }, '14e-manual-offer')).status, 409);

    const reassigned = await request('POST', `/dispatch/bookings/${booking.id}/manual`, admin.token, manualBody, '14e-manual-reassign');
    assert.equal(reassigned.status, 200);
    assert.notEqual(reassigned.body.data.assignments.at(-1).id, assignmentId);
    assert.equal((await db.assignment.findUniqueOrThrow({ where: { id: assignmentId } })).status, 'CANCELLED');
    assert.ok(await db.auditLog.findFirst({ where: { actorUserId: admin.user.id, action: 'BOOKING_MANUAL_REASSIGNED' } }));

    const detail = await request('GET', `/admin/bookings/${booking.id}`, admin.token);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.customer.phone, customerUser.phone);
    assert.equal(detail.body.data.assignments.at(-1).company.name, company.name);
    assert.equal(detail.body.data.assignments.at(-1).team.name, team.name);
    assert.equal(Array.isArray(detail.body.data.dispatchAttempts), true);
    assert.equal((await request('GET', '/dispatch/monitoring', admin.token)).status, 200);
    assert.equal((await request('GET', '/dispatch/monitoring', dispatcher.token)).status, 200);

    const noTeam = await db.booking.create({ data: {
      bookingNumber: `E14-N-${suffix}`, customerId: customer.id, serviceId: service.id, propertyId: property.id, addressId: address.id,
      scheduledAt: new Date('2027-01-02T10:00:00Z'), estimatedEndAt: new Date('2027-01-02T11:00:00Z'), status: 'SEARCHING_FOR_TEAM', price: '20.00', currency: 'JOD',
      addressSnapshot: { addressText: '14E address' }, propertySnapshot: { type: 'APARTMENT' }, serviceSnapshot: { name: '14E service', nameAr: 'خدمة 14E', durationMinutes: 60 }, locationLatitude: '31.95', locationLongitude: '35.91',
    } });
    const terminal = await request('POST', `/bookings/${noTeam.id}/no-team-available`, admin.token, {}, '14e-no-team');
    assert.equal(terminal.status, 200); assert.equal(terminal.body.data.status, 'NO_TEAM_AVAILABLE');
    assert.equal((await request('POST', `/dispatch/bookings/${noTeam.id}/offer`, admin.token, undefined, '14e-terminal-offer')).status, 409);

    const accepted = await db.booking.create({ data: {
      bookingNumber: `E14-A-${suffix}`, customerId: customer.id, serviceId: service.id, propertyId: property.id, addressId: address.id,
      scheduledAt: new Date('2027-01-03T10:00:00Z'), estimatedEndAt: new Date('2027-01-03T11:00:00Z'), status: 'TEAM_ACCEPTED', price: '20.00', currency: 'JOD',
      addressSnapshot: { addressText: '14E address' }, propertySnapshot: { type: 'APARTMENT' }, serviceSnapshot: { name: '14E service', nameAr: 'خدمة 14E', durationMinutes: 60 }, locationLatitude: '31.95', locationLongitude: '35.91',
    } });
    const acceptedReassign = await request('POST', `/dispatch/bookings/${accepted.id}/manual`, admin.token, manualBody, '14e-accepted-reassign');
    assert.equal(acceptedReassign.status, 409);
    assert.equal(acceptedReassign.body.error.code, 'DISPATCH_ACCEPTED_JOB_REASSIGNMENT_UNSUPPORTED');
  } finally {
    await app.close();
  }
});
