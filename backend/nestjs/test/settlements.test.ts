import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

test('Phase 10 settlement lifecycle, calculation, allocation, reconciliation and isolation are explicit', async () => {
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const { sessionHash } = await import('../dist/auth/authorization.js');
  const app = await createApp();
  const db = app.get(PrismaService);
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    async function identity(roleName: string, companyId?: string) {
      const role = await db.role.findUniqueOrThrow({ where: { name: roleName as any } });
      const user = await db.user.create({ data: { phone: `+p10-${randomUUID()}`.slice(0, 20), customer: { create: {} }, roles: { create: { roleId: role.id, ...(companyId ? { companyId } : {}) } } } });
      const token = randomBytes(32).toString('base64url');
      await db.session.create({ data: { userId: user.id, accessTokenHash: sessionHash(token), refreshTokenHash: sessionHash(randomBytes(32).toString('hex')), accessExpiresAt: new Date(Date.now() + 600000), expiresAt: new Date(Date.now() + 1200000) } });
      return token;
    }
    async function request(method: string, path: string, token: string, key?: string, body?: unknown) {
      const response = await fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() as any };
    }
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
    const admin = await identity('HOME_CLEAN_ADMIN');
    const manager = await identity('COMPANY_MANAGER');
    const otherCompany = await db.company.create({ data: { internalCode: `P10-C2-${suffix}`, name: 'Phase 10 Other', status: 'ACTIVE', commissionRate: '0.20' } });
    const otherManager = await identity('COMPANY_MANAGER', otherCompany.id);
    const company = await db.company.create({ data: { internalCode: `P10-C1-${suffix}`, name: 'Phase 10 Company', status: 'ACTIVE', commissionRate: '0.20' } });
    const scopedManager = await identity('COMPANY_MANAGER', company.id);
    const service = await db.service.create({ data: { code: `P10-S-${suffix}`, name: 'Phase 10 Service', nameAr: 'خدمة المرحلة 10', basePrice: '100.00', durationMinutes: 60, active: true } });
    const team = await db.team.create({ data: { companyId: company.id, internalCode: `P10-T-${suffix}`, name: 'Phase 10 Team', status: 'AVAILABLE', active: true } });
    const customer = await db.user.create({ data: { phone: `+p10-c-${suffix}`.slice(0, 20), customer: { create: {} } } });
    const customerRow = await db.customer.findUniqueOrThrow({ where: { userId: customer.id } });
    const address = await db.address.create({ data: { customerId: customerRow.id, label: 'P10', addressText: 'P10 address', latitude: '31.9500000', longitude: '35.9100000' } });
    const property = await db.property.create({ data: { customerId: customerRow.id, type: 'APARTMENT', size: '100.00', rooms: 2, bathrooms: 1 } });
    const at = new Date('2027-08-01T10:00:00Z');
    const booking = await db.booking.create({ data: { bookingNumber: `HC-P10-${suffix}`, customerId: customerRow.id, serviceId: service.id, propertyId: property.id, addressId: address.id, scheduledAt: at, estimatedEndAt: new Date(at.getTime() + 3600000), status: 'COMPLETED', paymentMethod: 'ONLINE', price: '100.00', currency: 'JOD', addressSnapshot: {}, propertySnapshot: {}, serviceSnapshot: {}, locationLatitude: '31.9500000', locationLongitude: '35.9100000' } });
    const assignment = await db.assignment.create({ data: { bookingId: booking.id, companyId: company.id, teamId: team.id, status: 'COMPLETED', startsAt: at, endsAt: new Date(at.getTime() + 3600000), expiresAt: new Date(at.getTime() - 3600000) } });
    const payment = await db.payment.create({ data: { bookingId: booking.id, method: 'ONLINE', status: 'RECONCILED', amount: '100.00', currency: 'JOD', provider: 'test', transactionReference: `p10-txn-${suffix}` } });
    const refund = await db.refund.create({ data: { paymentId: payment.id, amount: '10.00', status: 'SUCCEEDED', reason: 'Phase 10 test refund', provider: 'test', reference: `p10-refund-${suffix}` } });
    await db.refundHistory.create({ data: { refundId: refund.id, previousStatus: 'PENDING', newStatus: 'SUCCEEDED', provider: 'test', reference: refund.reference! } });
    await db.payment.update({ where: { id: payment.id }, data: { status: 'PARTIALLY_REFUNDED' } });
    const created = await request('POST', '/settlements', admin, `p10-create-${suffix}`, { companyId: company.id, periodStart: '2027-08-01T00:00:00Z', periodEnd: '2027-08-02T00:00:00Z' });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.status, 'CALCULATED');
    assert.equal(Number(created.body.data.total), 72);
    assert.equal((await request('GET', `/settlements/${created.body.data.id}`, scopedManager)).status, 403);
    const detail = await request('GET', `/settlements/${created.body.data.id}`, admin);
    assert.equal(detail.status, 200);
    assert.equal(Number(detail.body.data.items[0].payable.platformCommission), 18);
    assert.equal(detail.body.data.allocations[0].paymentId, payment.id);
    assert.equal((await request('POST', `/settlements/${created.body.data.id}/submit-review`, admin, `p10-review-${suffix}`)).body.data.status, 'READY_FOR_REVIEW');
    assert.equal((await request('POST', `/settlements/${created.body.data.id}/approve`, admin, `p10-approve-${suffix}`)).body.data.status, 'APPROVED');
    assert.equal((await request('POST', `/settlements/${created.body.data.id}/payments`, admin, `p10-pay-${suffix}`, { amount: '72.00', direction: 'TO_PROVIDER', reference: `p10-payout-${suffix}` })).body.data.status, 'PAID');
    const reconciliation = await request('POST', `/settlements/${created.body.data.id}/reconcile`, admin, `p10-reconcile-${suffix}`);
    assert.equal(reconciliation.status, 200);
    assert.equal(reconciliation.body.data.status, 'MATCHED');
    assert.equal((await request('POST', `/settlements/${created.body.data.id}/close`, admin, `p10-close-${suffix}`)).body.data.status, 'CLOSED');
    assert.equal((await request('GET', `/settlements/${created.body.data.id}`, otherManager)).status, 403);
    assert.equal((await request('GET', `/settlements/${created.body.data.id}`, manager)).status, 403);
    const duplicate = await request('POST', '/settlements', admin, `p10-duplicate-${suffix}`, { companyId: company.id, periodStart: '2027-08-01T00:00:00Z', periodEnd: '2027-08-02T00:00:00Z' });
    assert.equal(duplicate.status, 409);
    assert.equal(await db.settlementPaymentAllocation.count({ where: { paymentId: payment.id } }), 1);
    assert.equal(await db.settlementHistory.count({ where: { settlementId: created.body.data.id } }), 6);
    assert.equal(await db.auditLog.count({ where: { resourceId: created.body.data.id } }) >= 5, true);
    assert.equal(await db.assignment.count({ where: { id: assignment.id } }), 1);

    const cashAt = new Date('2027-09-01T10:00:00Z');
    const cashBooking = await db.booking.create({ data: { bookingNumber: `HC-P10-CASH-${suffix}`, customerId: customerRow.id, serviceId: service.id, propertyId: property.id, addressId: address.id, scheduledAt: cashAt, estimatedEndAt: new Date(cashAt.getTime() + 3600000), status: 'COMPLETED', paymentMethod: 'CASH', price: '50.00', currency: 'JOD', addressSnapshot: {}, propertySnapshot: {}, serviceSnapshot: {}, locationLatitude: '31.9500000', locationLongitude: '35.9100000' } });
    await db.assignment.create({ data: { bookingId: cashBooking.id, companyId: company.id, teamId: team.id, status: 'COMPLETED', startsAt: cashAt, endsAt: new Date(cashAt.getTime() + 3600000), expiresAt: new Date(cashAt.getTime() - 3600000) } });
    const cashPayment = await db.payment.create({ data: { bookingId: cashBooking.id, method: 'CASH', status: 'RECONCILED', amount: '50.00', currency: 'JOD', transactionReference: `p10-cash-${suffix}` } });
    await db.cashCollection.create({ data: { paymentId: cashPayment.id, collectedByUserId: customer.id, collectorCompanyId: company.id, collectorTeamId: team.id, amount: '50.00' } });
    const concurrent = await Promise.all([1, 2].map(index => request('POST', '/settlements', admin, `p10-concurrent-${suffix}-${index}`, { companyId: company.id, periodStart: '2027-09-01T00:00:00Z', periodEnd: '2027-09-02T00:00:00Z' })));
    assert.deepEqual(concurrent.map(result => result.status).sort(), [201, 409]);
    const cashSettlement = concurrent.find(result => result.status === 201)!.body.data;
    assert.equal(Number(cashSettlement.total), -10);
    await request('POST', `/settlements/${cashSettlement.id}/approve`, admin, `p10-cash-approve-${suffix}`);
    assert.equal((await request('POST', `/settlements/${cashSettlement.id}/payments`, admin, `p10-cash-pay-${suffix}`, { amount: '10.00', direction: 'TO_PLATFORM', reference: `p10-cash-payout-${suffix}` })).body.data.status, 'PAID');
    await db.payment.update({ where: { id: cashPayment.id }, data: { amount: '49.00' } });
    assert.equal(Number((await db.payment.findUniqueOrThrow({ where: { id: cashPayment.id } })).amount), 49);
    const discrepancy = await request('POST', `/settlements/${cashSettlement.id}/reconcile`, admin, `p10-cash-reconcile-${suffix}`);
    assert.equal(discrepancy.body.data.status, 'DISCREPANCY');
    assert.notEqual(Number(discrepancy.body.data.difference), 0);
    assert.equal((await request('POST', `/settlements/${cashSettlement.id}/reverse`, admin, `p10-cash-reverse-${suffix}`, { reason: 'Explicit discrepancy reversal' })).body.data.status, 'REVERSED');
  } finally { await app.close(); }
});
