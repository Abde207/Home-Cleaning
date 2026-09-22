import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

test('Phase 14F Admin finance projections are safe, filtered and permission-gated', async () => {
  process.env.NODE_ENV = 'test';
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const { sessionHash } = await import('../dist/auth/authorization.js');
  const app = await createApp();
  const db = app.get(PrismaService);
  async function identity(roleName: 'HOME_CLEAN_ADMIN' | 'DISPATCHER') {
    const role = await db.role.findUniqueOrThrow({ where: { name: roleName } });
    const user = await db.user.create({ data: { phone: `+16${randomUUID().replaceAll('-', '').slice(0, 12)}`, name: `14F ${roleName}`, roles: { create: { roleId: role.id } } } });
    const token = randomBytes(32).toString('base64url');
    await db.session.create({ data: { userId: user.id, accessTokenHash: sessionHash(token), refreshTokenHash: sessionHash(randomBytes(32).toString('base64url')), accessExpiresAt: new Date(Date.now() + 600_000), expiresAt: new Date(Date.now() + 1_200_000) } });
    return { user, token };
  }
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    const get = async (path: string, token: string) => { const response = await fetch(`${base}${path}`, { headers: { authorization: `Bearer ${token}` } }); return { status: response.status, body: await response.json() as any }; };
    const admin = await identity('HOME_CLEAN_ADMIN');
    const dispatcher = await identity('DISPATCHER');
    const user = await db.user.create({ data: { phone: `+17${randomUUID().replaceAll('-', '').slice(0, 12)}`, name: '14F Customer' } });
    const customer = await db.customer.create({ data: { userId: user.id } });
    const company = await db.company.create({ data: { internalCode: `F14-${randomUUID().slice(0, 8).toUpperCase()}`, name: '14F Company', status: 'ACTIVE', commissionRate: '0.20' } });
    const service = await db.service.create({ data: { code: `F14_${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`, name: '14F Service', nameAr: 'خدمة 14F', basePrice: '25.00', durationMinutes: 60, active: true } });
    const address = await db.address.create({ data: { customerId: customer.id, label: 'Home', addressText: '14F address', latitude: '31.95', longitude: '35.91' } });
    const property = await db.property.create({ data: { customerId: customer.id, type: 'APARTMENT', size: '80', rooms: 2, bathrooms: 1 } });
    const booking = await db.booking.create({ data: { bookingNumber: `F14-${randomUUID().slice(0, 8).toUpperCase()}`, customerId: customer.id, serviceId: service.id, propertyId: property.id, addressId: address.id, scheduledAt: new Date('2027-09-01T10:00:00Z'), estimatedEndAt: new Date('2027-09-01T11:00:00Z'), status: 'PAYMENT_CONFIRMED', paymentMethod: 'ONLINE', price: '25.00', currency: 'JOD', addressSnapshot: { addressText: '14F address' }, propertySnapshot: { type: 'APARTMENT' }, serviceSnapshot: { name: '14F Service', nameAr: 'خدمة 14F' }, locationLatitude: '31.95', locationLongitude: '35.91' } });
    const payment = await db.payment.create({ data: { bookingId: booking.id, method: 'ONLINE', status: 'CONFIRMED', amount: '25.00', currency: 'JOD', provider: 'mock', transactionReference: `F14-TXN-${randomUUID()}` } });
    await db.paymentAttempt.create({ data: { paymentId: payment.id, provider: 'mock', attemptNumber: 1, status: 'SUCCEEDED', providerReference: `F14-REF-${randomUUID()}`, checkoutUrl: 'https://secret.invalid/checkout', requestKey: `f14-${randomUUID()}`, amount: '25.00', currency: 'JOD' } });
    await db.paymentEvent.create({ data: { paymentId: payment.id, provider: 'mock', eventId: `f14-event-${randomUUID()}`, type: 'PAYMENT_CONFIRMED', payloadHash: 'a'.repeat(64), signatureVerified: true } });
    const refund = await db.refund.create({ data: { paymentId: payment.id, amount: '5.00', status: 'SUCCEEDED', provider: 'mock', reference: `F14-REFUND-${randomUUID()}`, reason: '14F fixture' } });
    await db.refundHistory.create({ data: { refundId: refund.id, previousStatus: 'PENDING', newStatus: 'SUCCEEDED', provider: 'mock', reason: '14F fixture' } });
    const cashBooking = await db.booking.create({ data: { bookingNumber: `F14-C-${randomUUID().slice(0, 8).toUpperCase()}`, customerId: customer.id, serviceId: service.id, propertyId: property.id, addressId: address.id, scheduledAt: new Date('2027-09-02T10:00:00Z'), estimatedEndAt: new Date('2027-09-02T11:00:00Z'), status: 'PAYMENT_RECONCILIATION', paymentMethod: 'CASH', price: '25.00', currency: 'JOD', addressSnapshot: {}, propertySnapshot: {}, serviceSnapshot: { name: '14F Service', nameAr: 'خدمة 14F' }, locationLatitude: '31.95', locationLongitude: '35.91' } });
    const cash = await db.payment.create({ data: { bookingId: cashBooking.id, method: 'CASH', status: 'CASH_COLLECTED', amount: '25.00', currency: 'JOD' } });
    await db.cashCollection.create({ data: { paymentId: cash.id, collectedByUserId: admin.user.id, collectorCompanyId: company.id, amount: '25.00' } });
    const settlement = await db.settlement.create({ data: { companyId: company.id, reference: `F14-SET-${randomUUID().slice(0, 8).toUpperCase()}`, status: 'READY_FOR_REVIEW', periodStart: new Date('2027-09-01T00:00:00Z'), periodEnd: new Date('2027-09-03T00:00:00Z'), total: '20.00', currency: 'JOD' } });

    assert.equal((await get('/admin/payments?method=ONLINE&hasRefund=true', admin.token)).status, 200);
    const detail = await get(`/admin/payments/${payment.id}`, admin.token);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.refundTotal, '5');
    assert.equal('checkoutUrl' in detail.body.data.attempts[0], false);
    assert.equal('requestKey' in detail.body.data.attempts[0], false);
    assert.equal('payloadHash' in detail.body.data.events[0], false);
    assert.equal((await get('/admin/refunds?status=SUCCEEDED', admin.token)).body.data[0].id, refund.id);
    const cashRows = await get('/admin/cash-reconciliation?state=COLLECTED', admin.token);
    assert.equal(cashRows.status, 200);
    assert.equal(cashRows.body.data[0].paymentId, cash.id);
    assert.equal((await get('/admin/settlements?status=READY_FOR_REVIEW', admin.token)).body.data[0].id, settlement.id);
    const settlementDetail = await get(`/admin/settlements/${settlement.id}`, admin.token);
    assert.equal(settlementDetail.status, 200);
    assert.equal(settlementDetail.body.data.company.id, company.id);
    assert.equal((await get('/admin/payments', dispatcher.token)).status, 403);
    assert.equal((await get('/admin/cash-reconciliation', dispatcher.token)).status, 403);
    assert.equal((await get('/admin/settlements', dispatcher.token)).status, 403);
  } finally { await app.close(); }
});
