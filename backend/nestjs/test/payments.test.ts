import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';

test('Phase 9 online, cash, refund, settlement and authorization boundaries are server-owned', async () => {
  process.env.PAYMENT_WEBHOOK_SECRET = 'live-phase9-webhook-secret-at-least-32';
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const { sessionHash } = await import('../dist/auth/authorization.js');
  const app = await createApp();
  const db = app.get(PrismaService);
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    async function identity(roleName: string, companyId?: string, teamId?: string) {
      const role = await db.role.findUniqueOrThrow({ where: { name: roleName as any } });
      const user = await db.user.create({ data: { phone: `+p9-${randomUUID()}`.slice(0, 20), customer: { create: {} }, roles: { create: { roleId: role.id, ...(companyId ? { companyId } : {}), ...(teamId ? { teamId } : {}) } } } });
      const token = randomBytes(32).toString('base64url');
      await db.session.create({ data: { userId: user.id, accessTokenHash: sessionHash(token), refreshTokenHash: sessionHash(randomBytes(32).toString('hex')), accessExpiresAt: new Date(Date.now() + 600000), expiresAt: new Date(Date.now() + 1200000) } });
      return { user, token, customer: await db.customer.findUniqueOrThrow({ where: { userId: user.id } }) };
    }
    async function request(method: string, path: string, token: string | undefined, key?: string, body?: unknown) {
      const headers: Record<string, string> = { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) };
      if (key) headers['Idempotency-Key'] = key;
      const response = await fetch(`${base}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() as any };
    }
    async function webhook(body: Record<string, unknown>, valid = true) {
      const raw = JSON.stringify(body);
      const signature = valid ? createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET!).update(raw).digest('hex') : '0'.repeat(64);
      const response = await fetch(`${base}/webhooks/payments/mock`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-payment-signature': signature }, body: raw });
      return { status: response.status, body: await response.json() as any };
    }
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
    const admin = await identity('HOME_CLEAN_ADMIN');
    const customer = await identity('CUSTOMER');
    const otherCustomer = await identity('CUSTOMER');
    const company = await db.company.create({ data: { internalCode: `P9-C-${suffix}`, name: 'Phase 9 Company', status: 'ACTIVE', commissionRate: '0.20' } });
    const team = await db.team.create({ data: { companyId: company.id, internalCode: `P9-T-${suffix}`, name: 'Phase 9 Team', status: 'AVAILABLE', active: true } });
    const cleaner = await identity('TEAM_LEADER_CLEANER', company.id, team.id);
    const manager = await identity('COMPANY_MANAGER', company.id);
    const service = await db.service.create({ data: { code: `P9-S-${suffix}`, name: 'Phase 9 Service', nameAr: 'خدمة المرحلة 9', basePrice: '25.00', durationMinutes: 60, active: true } });
    await db.teamServiceCapability.create({ data: { teamId: team.id, serviceId: service.id } });
    const address = await db.address.create({ data: { customerId: customer.customer.id, label: 'P9', addressText: 'P9 address', latitude: '31.9500000', longitude: '35.9100000' } });
    const property = await db.property.create({ data: { customerId: customer.customer.id, type: 'APARTMENT', size: '90.00', rooms: 2, bathrooms: 1 } });
    const createBooking = async (at: string, key: string) => (await request('POST', '/bookings', customer.token, key, { serviceId: service.id, propertyId: property.id, addressId: address.id, scheduledAt: at, extras: [] })).body.data;

    const online = await createBooking('2027-05-01T10:00:00Z', `p9-online-create-${suffix}`);
    assert.equal((await request('POST', `/bookings/${online.id}/confirm`, customer.token, `p9-online-confirm-${suffix}`)).status, 200);
    const paymentRequests = await Promise.all([1, 2].map(() => request('POST', '/payments', customer.token, `p9-payment-${suffix}`, { bookingId: online.id })));
    assert.deepEqual(paymentRequests.map(result => result.status).sort(), [201, 201]);
    assert.equal(paymentRequests[0].body.data.id, paymentRequests[1].body.data.id);
    const payment = paymentRequests[0].body.data;
    assert.equal(payment.status, 'PENDING');
    assert.equal((await request('GET', `/payments/${payment.id}`, otherCustomer.token)).status, 404);
    assert.equal((await webhook({ eventId: `p9-invalid-${suffix}`, type: 'SUCCEEDED', paymentReference: payment.providerReference, transactionReference: `p9-invalid-txn-${suffix}`, amount: '99.00', currency: 'JOD' }, false)).status, 401);
    const mismatch = await webhook({ eventId: `p9-mismatch-${suffix}`, type: 'SUCCEEDED', paymentReference: payment.providerReference, transactionReference: `p9-mismatch-txn-${suffix}`, amount: '99.00', currency: 'JOD' });
    assert.equal(mismatch.status, 200);
    assert.equal(mismatch.body.data.accepted, false);
    assert.equal((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status, 'PENDING');
    assert.equal((await webhook({ eventId: `p9-wrong-attempt-${suffix}`, type: 'SUCCEEDED', paymentReference: payment.providerReference,
      transactionReference: `p9-wrong-attempt-txn-${suffix}`, amount: '25.00', currency: 'JOD', attemptId: randomUUID(), bookingReference: online.bookingNumber })).status, 409);
    assert.equal((await webhook({ eventId: `p9-wrong-booking-${suffix}`, type: 'SUCCEEDED', paymentReference: payment.providerReference,
      transactionReference: `p9-wrong-booking-txn-${suffix}`, amount: '25.00', currency: 'JOD', attemptId: payment.attempt.id, bookingReference: 'BOOKING-WRONG' })).status, 409);
    const successEvent = { eventId: `p9-success-${suffix}`, type: 'SUCCEEDED', paymentReference: payment.providerReference, transactionReference: `p9-capture-${suffix}`, amount: '25.00', currency: 'JOD' };
    assert.equal((await webhook(successEvent)).body.data.accepted, true);
    assert.equal((await webhook(successEvent)).body.data.duplicate, true);
    assert.equal((await db.booking.findUniqueOrThrow({ where: { id: online.id } })).status, 'PAYMENT_CONFIRMED');
    assert.equal((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status, 'CONFIRMED');
    assert.equal((await request('GET', `/payments/${payment.id}`, customer.token)).status, 200);

    const failedBooking = await createBooking('2027-05-02T10:00:00Z', `p9-failed-create-${suffix}`);
    await request('POST', `/bookings/${failedBooking.id}/confirm`, customer.token, `p9-failed-confirm-${suffix}`);
    const failedPayment = (await request('POST', '/payments', customer.token, `p9-failed-pay-${suffix}`, { bookingId: failedBooking.id })).body.data;
    const failedEvent = { eventId: `p9-failed-event-${suffix}`, type: 'FAILED', paymentReference: failedPayment.providerReference, transactionReference: `p9-failed-txn-${suffix}`, amount: '25.00', currency: 'JOD' };
    assert.equal((await webhook(failedEvent)).body.data.accepted, false);
    assert.equal((await db.payment.findUniqueOrThrow({ where: { id: failedPayment.id } })).status, 'FAILED');
    assert.equal((await request('POST', `/payments/${failedPayment.id}/retry`, customer.token, `p9-retry-${suffix}`)).status, 200);
    assert.equal((await db.paymentAttempt.count({ where: { paymentId: failedPayment.id } })), 2);
    assert.equal((await webhook({ eventId: `p9-unknown-${suffix}`, type: 'SUCCEEDED', paymentReference: 'unknown-provider-reference', transactionReference: 'unknown-txn', amount: '25.00', currency: 'JOD' })).status, 409);

    // Put the verified online payment into the already-defined reconciliation boundary.
    await db.booking.update({ where: { id: online.id }, data: { status: 'PAYMENT_RECONCILIATION' } });
    await db.payment.update({ where: { id: payment.id }, data: { status: 'RECONCILED' } });
    const refund = await request('POST', `/payments/${payment.id}/refunds`, admin.token, `p9-refund-${suffix}`, { amount: '5.00', reason: 'Phase 9 partial refund' });
    assert.equal(refund.status, 201);
    assert.equal(refund.body.data.status, 'SUCCEEDED');
    assert.equal((await request('POST', `/payments/${payment.id}/refunds`, admin.token, `p9-refund-${suffix}`, { amount: '5.00', reason: 'Phase 9 partial refund' })).body.data.id, refund.body.data.id);
    assert.equal((await request('POST', `/payments/${payment.id}/refunds`, admin.token, `p9-over-refund-${suffix}`, { amount: '21.00', reason: 'Over refund' })).status, 409);
    assert.equal((await db.booking.findUniqueOrThrow({ where: { id: online.id } })).status, 'REFUNDED');
    assert.equal((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status, 'PARTIALLY_REFUNDED');

    const cash = await createBooking('2027-05-03T10:00:00Z', `p9-cash-create-${suffix}`);
    await request('POST', `/bookings/${cash.id}/confirm`, customer.token, `p9-cash-confirm-${suffix}`);
    await request('POST', `/bookings/${cash.id}/select-cash`, customer.token, `p9-cash-select-${suffix}`);
    await request('POST', `/bookings/${cash.id}/cash-payment-confirmed`, admin.token, `p9-cash-authorize-${suffix}`, { provider: 'cash-register', eventId: `p9-cash-event-${suffix}`, transactionReference: `p9-cash-auth-${suffix}`, payloadHash: 'a'.repeat(64) });
    const cashPayment = await db.payment.findFirstOrThrow({ where: { bookingId: cash.id } });
    const assignment = await db.assignment.create({ data: { bookingId: cash.id, companyId: company.id, teamId: team.id, status: 'COMPLETED', startsAt: new Date('2027-05-03T10:00:00Z'), endsAt: new Date('2027-05-03T11:00:00Z'), expiresAt: new Date('2027-05-03T09:30:00Z') } });
    await db.completionProof.create({ data: { assignmentId: assignment.id, storageKey: `p9-proof/${suffix}`, mimeType: 'image/jpeg', byteSize: 100 } });
    await db.booking.update({ where: { id: cash.id }, data: { status: 'CLEANING_COMPLETED' } });
    assert.equal((await request('POST', `/bookings/${cash.id}/start-payment-reconciliation`, admin.token, `p9-cash-recon-start-${suffix}`)).status, 200);
    const collected = await request('POST', `/assignments/${assignment.id}/collect-cash`, cleaner.token, `p9-cash-collect-${suffix}`, { amount: '25.00' });
    assert.equal(collected.status, 200);
    assert.equal((await request('POST', `/assignments/${assignment.id}/collect-cash`, cleaner.token, `p9-cash-collect-${suffix}` , { amount: '25.00' })).body.data.id, collected.body.data.id);
    assert.equal((await request('POST', `/assignments/${assignment.id}/collect-cash`, cleaner.token, `p9-cash-collect-other-${suffix}`, { amount: '25.00' })).status, 409);
    const collection = await db.cashCollection.findUniqueOrThrow({ where: { paymentId: cashPayment.id } });
    assert.equal(collection.collectorCompanyId, company.id);
    assert.equal(collection.collectorTeamId, team.id);
    assert.equal((await request('GET', `/payments/${cashPayment.id}`, manager.token)).status, 200);
    await request('POST', `/bookings/${cash.id}/reconcile-payment`, admin.token, `p9-cash-reconcile-${suffix}`);
    await request('POST', `/bookings/${cash.id}/complete`, admin.token, `p9-cash-complete-${suffix}`);

    const settlement = await request('POST', '/settlements', admin.token, `p9-settlement-create-${suffix}`, { companyId: company.id, periodStart: '2027-05-03T00:00:00Z', periodEnd: '2027-05-04T00:00:00Z' });
    assert.equal(settlement.status, 201);
    assert.equal((await request('POST', '/settlements', admin.token, `p9-settlement-create-${suffix}`, { companyId: company.id, periodStart: '2027-05-03T00:00:00Z', periodEnd: '2027-05-04T00:00:00Z' })).body.data.id, settlement.body.data.id);
    assert.equal((await request('GET', '/settlements', manager.token)).status, 200);
    assert.equal((await request('POST', `/settlements/${settlement.body.data.id}/approve`, admin.token, `p9-settlement-approve-${suffix}`)).status, 200);
    assert.equal((await request('POST', `/settlements/${settlement.body.data.id}/payments`, admin.token, `p9-settlement-pay-${suffix}`, { amount: '5.00', direction: 'TO_PLATFORM', reference: `p9-settle-payment-${suffix}` })).body.data.status, 'PAID');
    assert.equal((await db.settlementItem.count({ where: { settlementId: settlement.body.data.id } })), 1);
    assert.equal((await db.settlementHistory.count({ where: { settlementId: settlement.body.data.id } })), 3);
  } finally { await app.close(); }
});
