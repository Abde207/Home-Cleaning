import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

test('provider job execution is scoped, idempotent, concurrent and auditable', async () => {
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const { NotificationService } = await import('../dist/notifications/notification.service.js');
  const { sessionHash } = await import('../dist/auth/authorization.js');
  const app = await createApp();
  const db = app.get(PrismaService);
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
    async function identity(roleName: string, companyId?: string, teamId?: string) {
      const role = await db.role.findUniqueOrThrow({ where: { name: roleName as any } });
      const user = await db.user.create({ data: {
        phone: `+j-${randomUUID()}`.slice(0, 20),
        roles: { create: { roleId: role.id, ...(companyId ? { companyId } : {}), ...(teamId ? { teamId } : {}) } },
        ...(roleName === 'CUSTOMER' ? { customer: { create: {} } } : {}),
      } });
      const token = randomBytes(32).toString('base64url');
      await db.session.create({ data: { userId: user.id, accessTokenHash: sessionHash(token), refreshTokenHash: sessionHash(randomBytes(32).toString('hex')),
        accessExpiresAt: new Date(Date.now() + 600_000), expiresAt: new Date(Date.now() + 1_200_000) } });
      return { token, user };
    }
    async function request(method: string, path: string, token: string, key?: string, body?: unknown) {
      const headers: Record<string, string> = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
      if (key) headers['idempotency-key'] = key;
      const response = await fetch(`${base}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() as any };
    }

    const companyA = await db.company.create({ data: { internalCode: `J-A-${suffix}`, name: 'Execution A', status: 'ACTIVE', commissionRate: '0.20' } });
    const companyB = await db.company.create({ data: { internalCode: `J-B-${suffix}`, name: 'Execution B', status: 'ACTIVE', commissionRate: '0.20' } });
    const teamA1 = await db.team.create({ data: { companyId: companyA.id, internalCode: `J-A1-${suffix}`, name: 'A One', status: 'AVAILABLE', active: true } });
    const teamA2 = await db.team.create({ data: { companyId: companyA.id, internalCode: `J-A2-${suffix}`, name: 'A Two', status: 'AVAILABLE', active: true } });
    const teamB = await db.team.create({ data: { companyId: companyB.id, internalCode: `J-B1-${suffix}`, name: 'B One', status: 'AVAILABLE', active: true } });
    const managerA = await identity('COMPANY_MANAGER', companyA.id);
    const managerB = await identity('COMPANY_MANAGER', companyB.id);
    const cleanerA1 = await identity('TEAM_LEADER_CLEANER', companyA.id, teamA1.id);
    const cleanerA2 = await identity('TEAM_LEADER_CLEANER', companyA.id, teamA2.id);
    const customer = await identity('CUSTOMER');
    const customerRow = await db.customer.findUniqueOrThrow({ where: { userId: customer.user.id } });
    const service = await db.service.create({ data: { code: `J-S-${suffix}`, name: 'Execution clean', nameAr: 'تنظيف تنفيذي', basePrice: '25.00', durationMinutes: 60, active: true } });
    for (const team of [teamA1, teamA2, teamB]) await db.teamServiceCapability.create({ data: { teamId: team.id, serviceId: service.id } });
    const address = await db.address.create({ data: { customerId: customerRow.id, label: 'Home', addressText: 'Execution address', latitude: 31.95, longitude: 35.91 } });
    const property = await db.property.create({ data: { customerId: customerRow.id, type: 'APARTMENT', size: '90.00', rooms: 3, bathrooms: 2 } });
    let sequence = 0;
    async function fixture(status: 'TEAM_ACCEPTED' | 'TEAM_ON_THE_WAY' | 'CLEANING_STARTED' | 'CLEANING_COMPLETED' | 'CANCELLED' | 'REFUNDED', team = teamA1, cash = false) {
      sequence++;
      const at = new Date(Date.now() + sequence * 86_400_000);
      const assignmentStatus = ['CLEANING_COMPLETED', 'CANCELLED', 'REFUNDED'].includes(status) ? 'COMPLETED' : 'ACCEPTED';
      const booking = await db.booking.create({ data: {
        bookingNumber: `HC-J-${suffix}-${sequence}`, customerId: customerRow.id, serviceId: service.id, propertyId: property.id, addressId: address.id,
        scheduledAt: at, estimatedEndAt: new Date(at.getTime() + 3_600_000), status, paymentMethod: cash ? 'CASH' : 'ONLINE', price: '25.00', currency: 'JOD',
        addressSnapshot: { label: 'Home', addressText: 'Execution address', latitude: '31.95', longitude: '35.91' },
        propertySnapshot: { type: 'APARTMENT', size: '90.00', rooms: 3, bathrooms: 2 },
        serviceSnapshot: { name: 'Execution clean', nameAr: 'تنظيف تنفيذي', durationMinutes: 60 },
        locationLatitude: 31.95, locationLongitude: 35.91,
        payments: { create: { method: cash ? 'CASH' : 'ONLINE', status: 'CONFIRMED', amount: '25.00', currency: 'JOD' } },
      } });
      const assignment = await db.assignment.create({ data: { bookingId: booking.id, companyId: team.companyId, teamId: team.id, status: assignmentStatus,
        startsAt: at, endsAt: new Date(at.getTime() + 3_600_000), expiresAt: new Date(at.getTime() - 600_000), acceptedAt: new Date() } });
      return { booking, assignment };
    }

    const scoped = await fixture('TEAM_ACCEPTED');
    assert.equal((await request('POST', `/assignments/${scoped.assignment.id}/on-the-way`, managerA.token, `way-manager-${suffix}`)).status, 200);
    assert.equal((await request('POST', `/assignments/${scoped.assignment.id}/start-cleaning`, managerB.token, `foreign-${suffix}`)).status, 404);
    assert.equal((await request('POST', `/assignments/${scoped.assignment.id}/start-cleaning`, cleanerA2.token, `wrong-team-${suffix}`)).status, 404);
    assert.equal((await request('POST', `/assignments/${scoped.assignment.id}/start-cleaning`, customer.token, `customer-${suffix}`)).status, 403);
    assert.equal((await request('POST', `/assignments/${randomUUID()}/start-cleaning`, cleanerA1.token, `missing-${suffix}`)).status, 404);

    const startRace = await fixture('TEAM_ON_THE_WAY');
    const started = await Promise.all([
      request('POST', `/assignments/${startRace.assignment.id}/start-cleaning`, cleanerA1.token, `start-a-${suffix}`),
      request('POST', `/assignments/${startRace.assignment.id}/start-cleaning`, cleanerA1.token, `start-b-${suffix}`),
    ]);
    assert.deepEqual(started.map(row => row.status).sort(), [200, 409]);
    const winningStartKey = started[0].status === 200 ? `start-a-${suffix}` : `start-b-${suffix}`;
    const startReplay = await request('POST', `/assignments/${startRace.assignment.id}/start-cleaning`, cleanerA1.token, winningStartKey);
    assert.equal(startReplay.status, 200);
    assert.equal(await db.bookingStatusHistory.count({ where: { bookingId: startRace.booking.id, newStatus: 'CLEANING_STARTED' } }), 1);

    const ineligible = await fixture('TEAM_ON_THE_WAY');
    await db.team.update({ where: { id: teamA1.id }, data: { status: 'PAUSED' } });
    assert.equal((await request('POST', `/assignments/${ineligible.assignment.id}/start-cleaning`, cleanerA1.token, `paused-${suffix}`)).body.error.code, 'TEAM_NOT_OPERATIONAL');
    await db.team.update({ where: { id: teamA1.id }, data: { status: 'AVAILABLE' } });

    const completion = await fixture('CLEANING_STARTED');
    const completed = await Promise.all([
      request('POST', `/assignments/${completion.assignment.id}/complete-cleaning`, cleanerA1.token, `complete-a-${suffix}`),
      request('POST', `/assignments/${completion.assignment.id}/complete-cleaning`, cleanerA1.token, `complete-b-${suffix}`),
    ]);
    assert.deepEqual(completed.map(row => row.status).sort(), [200, 409]);
    const proofBody = { storageKey: `approved/proof-${suffix}`, mimeType: 'image/jpeg', byteSize: 512 };
    const proof = await request('POST', `/assignments/${completion.assignment.id}/completion-proof`, cleanerA1.token, `proof-${suffix}`, proofBody);
    const proofReplay = await request('POST', `/assignments/${completion.assignment.id}/completion-proof`, cleanerA1.token, `proof-${suffix}`, proofBody);
    assert.equal(proof.status, 201);
    assert.equal(proofReplay.body.data.id, proof.body.data.id);
    assert.equal(await db.completionProof.count({ where: { assignmentId: completion.assignment.id } }), 1);
    const recovered = await request('GET', `/provider/assignments/${completion.assignment.id}`, cleanerA1.token);
    assert.equal(recovered.body.data.completionProofs.length, 1);
    assert.equal(recovered.body.data.canSubmitCompletionProof, true);

    const cash = await fixture('CLEANING_STARTED', teamA1, true);
    await request('POST', `/assignments/${cash.assignment.id}/complete-cleaning`, cleanerA1.token, `cash-complete-${suffix}`);
    assert.equal((await request('POST', `/assignments/${cash.assignment.id}/collect-cash`, cleanerA2.token, `cash-wrong-team-${suffix}`, { amount: '25.00' })).status, 404);
    assert.equal((await request('POST', `/assignments/${cash.assignment.id}/collect-cash`, cleanerA1.token, `cash-wrong-amount-${suffix}`, { amount: '24.00' })).body.error.code, 'CASH_PAYMENT_NOT_COLLECTABLE');
    const collected = await Promise.all([
      request('POST', `/assignments/${cash.assignment.id}/collect-cash`, cleanerA1.token, `cash-a-${suffix}`, { amount: '25.00' }),
      request('POST', `/assignments/${cash.assignment.id}/collect-cash`, cleanerA1.token, `cash-b-${suffix}`, { amount: '25.00' }),
    ]);
    assert.deepEqual(collected.map(row => row.status).sort(), [200, 409]);
    assert.equal((await db.payment.findFirstOrThrow({ where: { bookingId: cash.booking.id } })).status, 'CASH_COLLECTED');
    assert.equal(await db.cashCollection.count({ where: { payment: { bookingId: cash.booking.id } } }), 1);
    const cancelledCash = await fixture('CANCELLED', teamA1, true);
    assert.equal((await request('POST', `/assignments/${cancelledCash.assignment.id}/collect-cash`, cleanerA1.token, `cash-cancelled-${suffix}`, { amount: '25.00' })).body.error.code, 'CASH_COLLECTION_NOT_ALLOWED');
    const refundedCash = await fixture('REFUNDED', teamA1, true);
    assert.equal((await request('POST', `/assignments/${refundedCash.assignment.id}/collect-cash`, cleanerA1.token, `cash-refunded-${suffix}`, { amount: '25.00' })).body.error.code, 'CASH_COLLECTION_NOT_ALLOWED');

    const noShow = await fixture('TEAM_ON_THE_WAY');
    const noShowRace = await Promise.all([
      request('POST', `/assignments/${noShow.assignment.id}/team-no-show`, cleanerA1.token, `noshow-a-${suffix}`),
      request('POST', `/assignments/${noShow.assignment.id}/team-no-show`, cleanerA1.token, `noshow-b-${suffix}`),
    ]);
    assert.deepEqual(noShowRace.map(row => row.status).sort(), [200, 409]);
    const customerNoShow = await fixture('CLEANING_STARTED');
    const customerNoShowRace = await Promise.all([
      request('POST', `/assignments/${customerNoShow.assignment.id}/customer-no-show`, cleanerA1.token, `customer-noshow-a-${suffix}`),
      request('POST', `/assignments/${customerNoShow.assignment.id}/customer-no-show`, cleanerA1.token, `customer-noshow-b-${suffix}`),
    ]);
    assert.deepEqual(customerNoShowRace.map(row => row.status).sort(), [200, 409]);

    const finalRows = await db.booking.findMany({ where: { id: { in: [startRace.booking.id, completion.booking.id, cash.booking.id, noShow.booking.id, customerNoShow.booking.id] } }, include: { history: true, assignments: { include: { events: true } } } });
    assert.ok(finalRows.every(row => row.history.length >= 1 && row.assignments[0].events.length >= 1));
    assert.ok(await db.auditLog.count({ where: { resourceType: { in: ['Booking', 'CashCollection', 'CompletionProof'] } } }) >= 8);
    const outboxBefore = await db.outboxEvent.count({ where: { processedAt: null } });
    assert.ok(outboxBefore >= 7);
    const notifications = app.get(NotificationService);
    for (let i = 0; i < 10; i++) {
      const result = await notifications.processOutboxOnce();
      if (!result.processed) break;
    }
    const customerNotifications = await db.notification.count({ where: { userId: customer.user.id } });
    assert.ok(customerNotifications >= 7);
    await notifications.processOutboxOnce();
    assert.equal(await db.notification.count({ where: { userId: customer.user.id } }), customerNotifications);
  } finally {
    await app.close();
  }
});
