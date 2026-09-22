import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

test('booking commands preserve snapshots, state history, payment separation, scope and idempotency', async () => {
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const { sessionHash } = await import('../dist/auth/authorization.js');
  const app = await createApp();
  const db = app.get(PrismaService);
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    async function identity(roleName: 'CUSTOMER' | 'HOME_CLEAN_ADMIN') {
      const role = await db.role.findUniqueOrThrow({ where: { name: roleName } });
      const user = await db.user.create({ data: { phone: `+test-${randomUUID()}`.slice(0, 20), customer: { create: {} }, roles: { create: { roleId: role.id } } } });
      const token = randomBytes(32).toString('base64url');
      await db.session.create({ data: { userId: user.id, accessTokenHash: sessionHash(token), refreshTokenHash: sessionHash(randomBytes(32).toString('hex')), accessExpiresAt: new Date(Date.now() + 600000), expiresAt: new Date(Date.now() + 1200000) } });
      const customer = await db.customer.findUniqueOrThrow({ where: { userId: user.id } });
      return { token, user, customer };
    }
    async function request(method: string, path: string, token: string, key?: string, body?: unknown) {
      const headers: Record<string, string> = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
      if (key) headers['Idempotency-Key'] = key;
      const response = await fetch(`${base}${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json() as any };
    }

    const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
    const customer = await identity('CUSTOMER');
    const other = await identity('CUSTOMER');
    const admin = await identity('HOME_CLEAN_ADMIN');
    const service = await db.service.create({ data: { code: `BOOKING_${suffix}`, name: 'Booking service', nameAr: 'خدمة حجز', description: 'Booking test', basePrice: '10.00', durationMinutes: 60, active: true } });
    const extra = await db.serviceExtra.create({ data: { serviceId: service.id, code: `EXTRA_${suffix}`, name: 'Windows', nameAr: 'نوافذ', price: '2.50', active: true } });
    const address = await db.address.create({ data: { customerId: customer.customer.id, label: 'Home', addressText: 'Original address', latitude: 31.95, longitude: 35.91 } });
    const property = await db.property.create({ data: { customerId: customer.customer.id, type: 'APARTMENT', size: '80.00', rooms: 2, bathrooms: 1 } });
    const otherAddress = await db.address.create({ data: { customerId: other.customer.id, label: 'Other', addressText: 'Other address', latitude: 31.96, longitude: 35.92 } });
    const otherProperty = await db.property.create({ data: { customerId: other.customer.id, type: 'HOUSE', size: '100.00', rooms: 3, bathrooms: 2 } });
    const createDto = { serviceId: service.id, propertyId: property.id, addressId: address.id, scheduledAt: '2027-03-01T10:00:00+03:00', instructions: 'Ring once', extras: [{ serviceExtraId: extra.id, quantity: 1 }] };

    const quoteResponse = await request('POST', '/bookings/quote', customer.token, undefined, { serviceId: service.id, propertyId: property.id, addressId: address.id, extras: [{ serviceExtraId: extra.id, quantity: 2 }] });
    assert.equal(quoteResponse.status, 201);
    assert.equal(quoteResponse.body.data.pricingVersion, 'catalog-v1');
    assert.equal(quoteResponse.body.data.basePrice, '10');
    assert.equal(quoteResponse.body.data.extras[0].lineTotal, '5');
    assert.equal(quoteResponse.body.data.total, '15');
    assert.equal(quoteResponse.body.data.adjustments.length, 0);
    assert.equal(quoteResponse.body.data.fees.length, 0);
    assert.equal(quoteResponse.body.data.discount, '0');
    assert.ok(new Date(quoteResponse.body.data.expiresAt).getTime() > Date.now());
    assert.equal((await request('POST', '/bookings/quote', customer.token, undefined, { serviceId: service.id, propertyId: otherProperty.id, addressId: otherAddress.id, extras: [] })).status, 404);

    assert.equal((await request('POST', '/bookings', customer.token)).status, 400, 'creation requires Idempotency-Key');
    const concurrentCreates = await Promise.all([
      request('POST', '/bookings', customer.token, 'booking-create-1', createDto),
      request('POST', '/bookings', customer.token, 'booking-create-1', createDto),
    ]);
    assert.deepEqual(concurrentCreates.map(result => result.status), [201, 201]);
    assert.equal(concurrentCreates[0].body.data.id, concurrentCreates[1].body.data.id);
    const created = concurrentCreates[0];
    assert.equal(created.status, 201);
    assert.equal(created.body.data.status, 'REQUESTED');
    assert.equal(Number(created.body.data.price), 12.5);
    assert.equal(created.body.data.addressSnapshot.addressText, 'Original address');
    assert.equal(created.body.data.extras[0].price, '2.5');
    assert.equal(created.body.data.priceSnapshot.pricingVersion, 'catalog-v1');
    assert.equal(await db.booking.count({ where: { customerId: customer.customer.id } }), 1);
    assert.equal(await db.bookingStatusHistory.count({ where: { bookingId: created.body.data.id } }), 1);

    const replay = await request('POST', '/bookings', customer.token, 'booking-create-1', createDto);
    assert.equal(replay.status, 201);
    assert.equal(replay.body.data.id, created.body.data.id);
    assert.equal(await db.booking.count({ where: { customerId: customer.customer.id } }), 1);
    assert.equal((await request('POST', '/bookings', customer.token, 'booking-create-1', { ...createDto, instructions: 'different' })).status, 409);

    const listed = await request('GET', '/bookings', customer.token);
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body.data.map((row: any) => row.id), [created.body.data.id]);
    assert.equal((await request('GET', '/bookings', admin.token)).status, 200);
    assert.equal((await request('GET', `/bookings/${created.body.data.id}`, admin.token)).status, 200);
    assert.equal((await request('GET', `/bookings/${created.body.data.id}`, other.token)).status, 404);
    assert.equal((await request('POST', '/bookings', customer.token, 'foreign-property', { ...createDto, propertyId: otherProperty.id, addressId: otherAddress.id })).status, 404);

    await db.address.update({ where: { id: address.id }, data: { addressText: 'Changed current address' } });
    const afterAddressChange = await request('GET', `/bookings/${created.body.data.id}`, customer.token);
    assert.equal(afterAddressChange.body.data.addressSnapshot.addressText, 'Original address');
    await db.serviceExtra.update({ where: { id: extra.id }, data: { price: '9.00' } });
    const afterExtraChange = await request('GET', `/bookings/${created.body.data.id}`, customer.token);
    assert.equal(afterExtraChange.body.data.extras[0].price, '2.5');

    const confirmed = await request('POST', `/bookings/${created.body.data.id}/confirm`, customer.token, 'booking-confirm-1');
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.data.status, 'PRICE_CONFIRMED');
    assert.equal((await request('POST', `/bookings/${created.body.data.id}/confirm`, customer.token, 'booking-confirm-1')).body.data.status, 'PRICE_CONFIRMED');
    const cash = await request('POST', `/bookings/${created.body.data.id}/select-cash`, customer.token, 'booking-cash-1');
    assert.equal(cash.status, 200);
    assert.equal(cash.body.data.status, 'CASH_SELECTED');
    assert.equal((await db.payment.findFirstOrThrow({ where: { bookingId: created.body.data.id } })).status, 'CASH_SELECTED');
    assert.equal((await request('POST', `/bookings/${created.body.data.id}/select-cash`, customer.token, 'booking-cash-1')).body.data.status, 'CASH_SELECTED');
    assert.equal((await request('POST', `/bookings/${created.body.data.id}/select-cash`, customer.token, 'booking-cash-2')).status, 409);
    const history = await db.bookingStatusHistory.findMany({ where: { bookingId: created.body.data.id }, orderBy: { createdAt: 'asc' } });
    assert.deepEqual(history.map(row => row.newStatus), ['REQUESTED', 'PRICE_CONFIRMED', 'CASH_SELECTED']);
    assert.equal(await db.auditLog.count({ where: { resourceId: created.body.data.id, action: { in: ['BOOKING_CREATED', 'BOOKING_PRICE_CONFIRMED', 'BOOKING_CASH_SELECTED'] } } }), 3);

    const cancelCreate = await request('POST', '/bookings', customer.token, 'booking-create-cancel', { ...createDto, scheduledAt: '2027-03-02T10:00:00+03:00' });
    const cancelled = await request('POST', `/bookings/${cancelCreate.body.data.id}/cancel`, customer.token, 'booking-cancel-1', { reason: 'Customer changed plans' });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.data.status, 'CANCELLED');
    assert.equal((await db.bookingStatusHistory.findFirstOrThrow({ where: { bookingId: cancelCreate.body.data.id, newStatus: 'CANCELLED' } })).reason, 'Customer changed plans');
    assert.equal((await request('POST', `/bookings/${created.body.data.id}/cancel`, customer.token, 'booking-cancel-invalid', { reason: 'Too late' })).status, 409);
  } finally { await app.close(); }
});
