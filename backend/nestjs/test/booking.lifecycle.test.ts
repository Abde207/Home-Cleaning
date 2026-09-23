import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

test('booking lifecycle boundaries keep quote, payment, assignment, proof, no-show and refund ownership server-side', async () => {
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
      const user = await db.user.create({ data: { phone: `+life-${randomUUID()}`.slice(0, 20), customer: { create: {} }, roles: { create: { roleId: role.id, ...(companyId ? { companyId } : {}), ...(teamId ? { teamId } : {}) } } } });
      const token = randomBytes(32).toString('base64url');
      await db.session.create({ data: { userId: user.id, accessTokenHash: sessionHash(token), refreshTokenHash: sessionHash(randomBytes(32).toString('hex')), accessExpiresAt: new Date(Date.now() + 600000), expiresAt: new Date(Date.now() + 1200000) } });
      return { token, user, customer: await db.customer.findUniqueOrThrow({ where: { userId: user.id } }) };
    }
    async function request(method: string, path: string, token: string, key?: string, body?: unknown) {
      const headers: Record<string, string> = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
      if (key) headers['Idempotency-Key'] = key;
      const response = await fetch(`${base}${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json() as any };
    }
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
    const admin = await identity('HOME_CLEAN_ADMIN');
    const customer = await identity('CUSTOMER');
    const company = await db.company.create({ data: { internalCode: `LIFE-C-${suffix}`, name: 'Lifecycle Company', status: 'ACTIVE', commissionRate: '0.20' } });
    const team = await db.team.create({ data: { companyId: company.id, internalCode: `LIFE-T-${suffix}`, name: 'Lifecycle Team', status: 'AVAILABLE', active: true } });
    const cleaner = await identity('TEAM_LEADER_CLEANER', company.id, team.id);
    const service = await db.service.create({ data: { code: `LIFE-S-${suffix}`, name: 'Lifecycle Service', nameAr: 'خدمة دورة الحياة', description: 'Lifecycle test', basePrice: '25.00', durationMinutes: 60, active: true } });
    await db.teamServiceCapability.create({ data: { teamId: team.id, serviceId: service.id } });
    await db.companyServiceArea.create({ data: { companyId: company.id, name: 'Lifecycle area', latitude: 31.95, longitude: 35.91, radiusKm: 20, active: true } });
    await db.teamAvailability.create({ data: { teamId: team.id, startsAt: new Date('2027-04-01T00:00:00Z'), endsAt: new Date('2027-04-05T00:00:00Z'), available: true } });
    const address = await db.address.create({ data: { customerId: customer.customer.id, label: 'Lifecycle', addressText: 'Lifecycle address', latitude: 31.95, longitude: 35.91 } });
    const property = await db.property.create({ data: { customerId: customer.customer.id, type: 'APARTMENT', size: '90.00', rooms: 2, bathrooms: 1 } });
    const createBooking = async (at: string, key: string) => (await request('POST', '/bookings', customer.token, key, { serviceId: service.id, propertyId: property.id, addressId: address.id, scheduledAt: at, extras: [] })).body.data;
    const payment = { provider: 'test-gateway', eventId: `evt-${suffix}`, transactionReference: `txn-${suffix}`, payloadHash: 'a'.repeat(64) };
    const assignment = { companyId: company.id, teamId: team.id, startsAt: '2027-04-01T10:00:00Z', endsAt: '2027-04-01T11:00:00Z', expiresAt: '2027-04-01T09:30:00Z', reason: 'Lifecycle manual dispatch' };

    const first = await createBooking('2027-04-01T10:00:00Z', `life-create-${suffix}`);
    const persistedQuote = await db.bookingPriceSnapshot.findUniqueOrThrow({ where: { bookingId: first.id } });
    const quote = { pricingVersion: 'catalog-v1', basePrice: '25.00', extrasTotal: '0.00', adjustments: '0.00', fees: '0.00', discount: '0.00', total: '25.00', currency: 'JOD', breakdown: persistedQuote.breakdown };
    assert.equal((await request('POST', `/bookings/${first.id}/quote-confirmed`, admin.token, `life-quote-${suffix}`, quote)).status, 200);
    assert.equal((await request('POST', `/bookings/${first.id}/quote-confirmed`, customer.token, `life-customer-quote-${suffix}`, quote)).status, 403);
    assert.equal((await request('POST', `/bookings/${first.id}/start-online-payment`, customer.token, `life-pay-start-${suffix}`)).body.data.status, 'PAYMENT_PENDING');
    assert.equal((await request('POST', `/bookings/${first.id}/payment-confirmed`, admin.token, `life-pay-confirm-${suffix}`, payment)).body.data.status, 'PAYMENT_CONFIRMED');
    const offeredResults = await Promise.all([
      request('POST', `/bookings/${first.id}/assign`, admin.token, `life-assign-${suffix}`, assignment),
      request('POST', `/bookings/${first.id}/assign`, admin.token, `life-assign-${suffix}`, assignment),
    ]);
    assert.deepEqual(offeredResults.map(result => result.status), [200, 200]);
    assert.equal(offeredResults[0].body.data.assignments[0].id, offeredResults[1].body.data.assignments[0].id);
    const offered = offeredResults[0];
    assert.equal(offered.body.data.status, 'TEAM_ASSIGNED');
    const assignmentId = offered.body.data.assignments[0].id;
    assert.equal((await request('POST', `/assignments/${assignmentId}/accept`, cleaner.token, `life-accept-${suffix}`)).body.data.status, 'ACCEPTED');
    assert.equal((await request('POST', `/assignments/${assignmentId}/on-the-way`, cleaner.token, `life-way-${suffix}`)).body.data.status, 'TEAM_ON_THE_WAY');
    assert.equal((await request('POST', `/assignments/${assignmentId}/start-cleaning`, cleaner.token, `life-start-${suffix}`)).body.data.status, 'CLEANING_STARTED');
    assert.equal((await request('POST', `/assignments/${assignmentId}/complete-cleaning`, cleaner.token, `life-finish-${suffix}`)).body.data.status, 'COMPLETED');
    assert.equal((await request('POST', `/bookings/${first.id}/start-payment-reconciliation`, admin.token, `life-recon-start-${suffix}`)).body.data.status, 'PAYMENT_RECONCILIATION');
    assert.equal((await request('POST', `/bookings/${first.id}/reconcile-payment`, admin.token, `life-recon-${suffix}`)).body.data.status, 'PAYMENT_RECONCILIATION');
    assert.equal((await request('POST', `/bookings/${first.id}/complete`, admin.token, `life-complete-${suffix}`)).body.data.status, 'COMPLETED');
    assert.equal((await request('POST', `/bookings/${first.id}/complete`, admin.token, `life-complete-${suffix}`)).body.data.status, 'COMPLETED');
    const firstDb = await db.booking.findUniqueOrThrow({ where: { id: first.id }, include: { payments: true, assignments: { include: { events: true, proofs: true } } } });
    assert.equal(firstDb.payments[0].status, 'RECONCILED');
    assert.equal(firstDb.assignments[0].status, 'COMPLETED');
    assert.equal(firstDb.assignments[0].proofs.length, 0);

    const cash = await createBooking('2027-04-02T10:00:00Z', `life-cash-create-${suffix}`);
    assert.equal((await request('POST', `/bookings/${cash.id}/confirm`, customer.token, `life-cash-confirm-${suffix}`)).body.data.status, 'PRICE_CONFIRMED');
    assert.equal((await request('POST', `/bookings/${cash.id}/select-cash`, customer.token, `life-cash-select-${suffix}`)).body.data.status, 'CASH_SELECTED');
    const cashEvent = { provider: 'cash-register', eventId: `cash-${suffix}`, transactionReference: `cash-auth-${suffix}`, payloadHash: 'b'.repeat(64) };
    assert.equal((await request('POST', `/bookings/${cash.id}/cash-payment-confirmed`, admin.token, `life-cash-authorize-${suffix}`, cashEvent)).body.data.status, 'PAYMENT_CONFIRMED');
    const cashOffer = await request('POST', `/bookings/${cash.id}/assign`, admin.token, `life-cash-assign-${suffix}`, { ...assignment, startsAt: '2027-04-02T10:00:00Z', endsAt: '2027-04-02T11:00:00Z', expiresAt: '2027-04-02T09:30:00Z' });
    const cashAssignmentId = cashOffer.body.data.assignments[0].id;
    for (const [path, key] of [['accept', 'life-cash-accept'], ['on-the-way', 'life-cash-way'], ['start-cleaning', 'life-cash-start'], ['complete-cleaning', 'life-cash-finish']] as const) assert.equal((await request('POST', `/assignments/${cashAssignmentId}/${path}`, cleaner.token, `${key}-${suffix}`)).status, 200);
    assert.equal((await request('POST', `/assignments/${cashAssignmentId}/completion-proof`, cleaner.token, `life-cash-proof-${suffix}`, { storageKey: `proof/cash-${suffix}`, mimeType: 'image/jpeg', byteSize: 128 })).status, 201);
    assert.equal((await request('POST', `/bookings/${cash.id}/start-payment-reconciliation`, admin.token, `life-cash-recon-start-${suffix}`)).status, 200);
    assert.equal((await request('POST', `/assignments/${cashAssignmentId}/collect-cash`, cleaner.token, `life-cash-collect-${suffix}`, { amount: '25.00' })).status, 200);
    assert.equal((await request('POST', `/bookings/${cash.id}/reconcile-payment`, admin.token, `life-cash-recon-${suffix}`)).status, 200);
    assert.equal((await request('POST', `/bookings/${cash.id}/complete`, admin.token, `life-cash-complete-${suffix}`)).body.data.status, 'COMPLETED');

    const noShow = await createBooking('2027-04-03T10:00:00Z', `life-noshow-create-${suffix}`);
    assert.equal((await request('POST', `/bookings/${noShow.id}/confirm`, customer.token, `life-noshow-confirm-${suffix}`)).status, 200);
    assert.equal((await request('POST', `/bookings/${noShow.id}/start-online-payment`, customer.token, `life-noshow-pay-${suffix}`)).status, 200);
    assert.equal((await request('POST', `/bookings/${noShow.id}/payment-confirmed`, admin.token, `life-noshow-payment-${suffix}`, { ...payment, eventId: `noshow-${suffix}`, transactionReference: `noshow-txn-${suffix}` })).status, 200);
    const noShowOffer = await request('POST', `/bookings/${noShow.id}/assign`, admin.token, `life-noshow-assign-${suffix}`, { ...assignment, startsAt: '2027-04-03T10:00:00Z', endsAt: '2027-04-03T11:00:00Z', expiresAt: '2027-04-03T09:30:00Z' });
    const rejectedAssignmentId = noShowOffer.body.data.assignments[0].id;
    assert.equal((await request('POST', `/assignments/${rejectedAssignmentId}/reject`, cleaner.token, `life-noshow-reject-${suffix}`, { reason: 'Team unavailable' })).body.data.status, 'REJECTED');
    assert.equal((await request('POST', `/bookings/${noShow.id}/retry-assignment`, admin.token, `life-noshow-retry-rejected-${suffix}`)).body.data.status, 'SEARCHING_FOR_TEAM');
    const noShowOfferRetry = await request('POST', `/bookings/${noShow.id}/assign`, admin.token, `life-noshow-assign-retry-${suffix}`, { ...assignment, startsAt: '2027-04-03T10:00:00Z', endsAt: '2027-04-03T11:00:00Z', expiresAt: '2027-04-03T09:30:00Z' });
    const noShowAssignmentId = noShowOfferRetry.body.data.assignments.at(-1).id;
    assert.equal((await request('POST', `/assignments/${noShowAssignmentId}/accept`, cleaner.token, `life-noshow-accept-${suffix}`)).status, 200);
    assert.equal((await request('POST', `/assignments/${noShowAssignmentId}/on-the-way`, cleaner.token, `life-noshow-way-${suffix}`)).status, 200);
    assert.equal((await request('POST', `/assignments/${noShowAssignmentId}/team-no-show`, cleaner.token, `life-noshow-mark-${suffix}`)).body.data.status, 'TEAM_NO_SHOW');
    assert.equal((await request('POST', `/bookings/${noShow.id}/retry-assignment`, admin.token, `life-noshow-retry-${suffix}`)).body.data.status, 'SEARCHING_FOR_TEAM');
    assert.equal((await request('POST', `/bookings/${noShow.id}/no-team-available`, admin.token, `life-noshow-none-${suffix}`)).body.data.status, 'NO_TEAM_AVAILABLE');

    const customerNoShow = await createBooking('2027-04-03T12:00:00Z', `life-customer-noshow-create-${suffix}`);
    assert.equal((await request('POST', `/bookings/${customerNoShow.id}/confirm`, customer.token, `life-customer-noshow-confirm-${suffix}`)).status, 200);
    assert.equal((await request('POST', `/bookings/${customerNoShow.id}/start-online-payment`, customer.token, `life-customer-noshow-pay-${suffix}`)).status, 200);
    assert.equal((await request('POST', `/bookings/${customerNoShow.id}/payment-confirmed`, admin.token, `life-customer-noshow-payment-${suffix}`, { ...payment, eventId: `customer-noshow-${suffix}`, transactionReference: `customer-noshow-txn-${suffix}` })).status, 200);
    const customerNoShowOffer = await request('POST', `/bookings/${customerNoShow.id}/assign`, admin.token, `life-customer-noshow-assign-${suffix}`, { ...assignment, startsAt: '2027-04-03T12:00:00Z', endsAt: '2027-04-03T13:00:00Z', expiresAt: '2027-04-03T11:30:00Z' });
    const customerNoShowAssignmentId = customerNoShowOffer.body.data.assignments[0].id;
    for (const [path, key] of [['accept', 'life-customer-noshow-accept'], ['on-the-way', 'life-customer-noshow-way'], ['start-cleaning', 'life-customer-noshow-start']] as const) assert.equal((await request('POST', `/assignments/${customerNoShowAssignmentId}/${path}`, cleaner.token, `${key}-${suffix}`)).status, 200);
    assert.equal((await request('POST', `/assignments/${customerNoShowAssignmentId}/customer-no-show`, cleaner.token, `life-customer-noshow-mark-${suffix}`)).body.data.status, 'CUSTOMER_NO_SHOW');

    const refund = await createBooking('2027-04-04T10:00:00Z', `life-refund-create-${suffix}`);
    assert.equal((await request('POST', `/bookings/${refund.id}/confirm`, customer.token, `life-refund-confirm-${suffix}`)).status, 200);
    assert.equal((await request('POST', `/bookings/${refund.id}/start-online-payment`, customer.token, `life-refund-pay-${suffix}`)).status, 200);
    assert.equal((await request('POST', `/bookings/${refund.id}/payment-confirmed`, admin.token, `life-refund-payment-${suffix}`, { ...payment, eventId: `refund-${suffix}`, transactionReference: `refund-txn-${suffix}` })).status, 200);
    const refundOffer = await request('POST', `/bookings/${refund.id}/assign`, admin.token, `life-refund-assign-${suffix}`, { ...assignment, startsAt: '2027-04-04T10:00:00Z', endsAt: '2027-04-04T11:00:00Z', expiresAt: '2027-04-04T09:30:00Z' });
    const refundAssignmentId = refundOffer.body.data.assignments[0].id;
    for (const [path, key] of [['accept', 'life-refund-accept'], ['on-the-way', 'life-refund-way'], ['start-cleaning', 'life-refund-start'], ['complete-cleaning', 'life-refund-finish']] as const) assert.equal((await request('POST', `/assignments/${refundAssignmentId}/${path}`, cleaner.token, `${key}-${suffix}`)).status, 200);
    await request('POST', `/assignments/${refundAssignmentId}/completion-proof`, cleaner.token, `life-refund-proof-${suffix}`, { storageKey: `proof/refund-${suffix}`, mimeType: 'image/jpeg', byteSize: 128 });
    await request('POST', `/bookings/${refund.id}/start-payment-reconciliation`, admin.token, `life-refund-recon-start-${suffix}`);
    await request('POST', `/bookings/${refund.id}/reconcile-payment`, admin.token, `life-refund-recon-${suffix}`);
    assert.equal((await request('POST', `/bookings/${refund.id}/refund`, admin.token, `life-refund-request-${suffix}`, { amount: '25.00', reason: 'Verified refund boundary' })).body.data.status, 'PENDING');
    assert.equal((await request('POST', `/bookings/${refund.id}/refund-completed`, admin.token, `life-refund-complete-${suffix}`, { reference: `refund-ref-${suffix}`, provider: 'test-gateway', eventId: `refund-result-${suffix}`, payloadHash: 'c'.repeat(64) })).body.data.status, 'SUCCEEDED');
    assert.equal((await db.booking.findUniqueOrThrow({ where: { id: refund.id } })).status, 'REFUNDED');
  } finally { await app.close(); }
});
