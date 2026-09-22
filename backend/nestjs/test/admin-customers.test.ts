import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

test('Phase 14C customer identity projections, filters, privacy and status authorization', async () => {
  process.env.NODE_ENV = 'test';
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const { sessionHash } = await import('../dist/auth/authorization.js');
  const app = await createApp();
  const db = app.get(PrismaService);

  async function identity(roleName: 'HOME_CLEAN_ADMIN' | 'DISPATCHER', name: string) {
    const role = await db.role.findUniqueOrThrow({ where: { name: roleName } });
    const user = await db.user.create({ data: { phone: `+18${randomUUID().replaceAll('-', '').slice(0, 12)}`, name, roles: { create: { roleId: role.id } } } });
    const token = randomBytes(32).toString('base64url');
    await db.session.create({ data: { userId: user.id, accessTokenHash: sessionHash(token), refreshTokenHash: sessionHash(randomBytes(32).toString('base64url')), accessExpiresAt: new Date(Date.now() + 600_000), expiresAt: new Date(Date.now() + 1_200_000) } });
    return { user, token };
  }

  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    async function request(method: string, path: string, token: string, body?: unknown) {
      const response = await fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() as any };
    }
    const admin = await identity('HOME_CLEAN_ADMIN', '14C Admin');
    const dispatcher = await identity('DISPATCHER', '14C Dispatcher');
    const customerRole = await db.role.findUniqueOrThrow({ where: { name: 'CUSTOMER' } });
    const customerUser = await db.user.create({ data: { phone: '+962790001234', name: 'Alice Customer', locale: 'en', roles: { create: { roleId: customerRole.id } } } });
    const customer = await db.customer.create({ data: { userId: customerUser.id } });
    const address = await db.address.create({ data: { customerId: customer.id, label: 'Home', addressText: 'Private address', latitude: 31.95, longitude: 35.91 } });
    const property = await db.property.create({ data: { customerId: customer.id, type: 'APARTMENT', size: '80', rooms: 2, bathrooms: 1 } });
    const service = await db.service.create({ data: { code: `C14_${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`, name: '14C Service', nameAr: 'خدمة 14C', description: 'fixture', basePrice: '10.00', durationMinutes: 60, active: true } });
    const booking = await db.booking.create({ data: { bookingNumber: `C14-${randomUUID().slice(0, 8).toUpperCase()}`, customerId: customer.id, serviceId: service.id, propertyId: property.id, addressId: address.id, scheduledAt: new Date('2027-01-01T10:00:00Z'), estimatedEndAt: new Date('2027-01-01T11:00:00Z'), status: 'PAYMENT_CONFIRMED', paymentMethod: 'CASH', price: '10.00', addressSnapshot: { addressText: 'Private address' }, propertySnapshot: { type: 'APARTMENT' }, serviceSnapshot: { name: '14C Service' }, locationLatitude: '31.95', locationLongitude: '35.91' } });
    const customerToken = randomBytes(32).toString('base64url');
    await db.session.create({ data: { userId: customerUser.id, accessTokenHash: sessionHash(customerToken), refreshTokenHash: sessionHash(randomBytes(32).toString('base64url')), accessExpiresAt: new Date(Date.now() + 600_000), expiresAt: new Date(Date.now() + 1_200_000) } });

    const list = await request('GET', '/admin/customers?status=ACTIVE&locale=en&query=Alice&limit=10&offset=0', admin.token);
    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 1);
    assert.deepEqual(list.body.data[0], { id: customer.id, userId: customerUser.id, name: 'Alice Customer', phone: customerUser.phone, locale: 'en', status: 'ACTIVE', createdAt: customerUser.createdAt.toISOString(), bookingCount: 1, lastBookingAt: booking.createdAt.toISOString() });
    assert.equal('addresses' in list.body.data[0], false);
    assert.equal((await request('GET', `/admin/customers/${customer.id}`, admin.token)).body.data.counts.addresses, 1);
    const detail = (await request('GET', `/admin/customers/${customer.id}`, admin.token)).body.data;
    assert.deepEqual(detail.counts, { addresses: 1, properties: 1, bookings: 1 });
    assert.equal(detail.recentBookings[0].id, booking.id);
    assert.equal('addressText' in detail.recentBookings[0], false);
    assert.equal('properties' in detail, false);
    assert.equal((await request('GET', `/admin/users?role=CUSTOMER&query=Alice`, admin.token)).body.data.some((row: any) => row.id === customerUser.id), true);
    assert.equal((await request('GET', '/admin/customers?status=NOT_A_STATUS', admin.token)).status, 400);
    assert.equal((await request('GET', '/admin/customers', dispatcher.token)).status, 403);
    assert.equal((await request('PUT', `/admin/users/${customerUser.id}/status`, dispatcher.token, { status: 'SUSPENDED' })).status, 403);

    assert.equal((await request('PUT', `/admin/users/${customerUser.id}/status`, admin.token, { status: 'SUSPENDED' })).status, 200);
    assert.equal((await request('GET', '/auth/me', customerToken)).status, 401);
    assert.equal(await db.session.count({ where: { userId: customerUser.id, revokedAt: null } }), 0);
    assert.equal(await db.auditLog.count({ where: { resourceId: customerUser.id, action: 'USER_STATUS_CHANGED' } }), 1);
  } finally { await app.close(); }
});
