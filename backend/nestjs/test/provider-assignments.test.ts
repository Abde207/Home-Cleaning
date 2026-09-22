import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

test('Provider assignment projection enforces role, company, team, actions and cash scope', async () => {
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const { sessionHash } = await import('../dist/auth/authorization.js');
  const app = await createApp();
  const db = app.get(PrismaService);
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
    async function identity(roleName: string, companyId?: string, teamId?: string) {
      const role = await db.role.findUniqueOrThrow({ where: { name: roleName as any } });
      const user = await db.user.create({ data: { phone: `+p-${randomUUID()}`.slice(0, 20),
        roles: { create: { roleId: role.id, ...(companyId ? { companyId } : {}), ...(teamId ? { teamId } : {}) } },
        ...(roleName === 'CUSTOMER' ? { customer: { create: {} } } : {}) } });
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

    const companyA = await db.company.create({ data: { internalCode: `P13-A-${suffix}`, name: 'Provider A', status: 'ACTIVE', commissionRate: '0.20' } });
    const companyB = await db.company.create({ data: { internalCode: `P13-B-${suffix}`, name: 'Provider B', status: 'ACTIVE', commissionRate: '0.20' } });
    const teamA1 = await db.team.create({ data: { companyId: companyA.id, internalCode: `P13-A1-${suffix}`, name: 'A One', status: 'AVAILABLE', active: true, capacity: 2 } });
    const teamA2 = await db.team.create({ data: { companyId: companyA.id, internalCode: `P13-A2-${suffix}`, name: 'A Two', status: 'AVAILABLE', active: true, capacity: 2 } });
    const teamB = await db.team.create({ data: { companyId: companyB.id, internalCode: `P13-B1-${suffix}`, name: 'B One', status: 'AVAILABLE', active: true, capacity: 2 } });
    const managerA = await identity('COMPANY_MANAGER', companyA.id);
    const managerB = await identity('COMPANY_MANAGER', companyB.id);
    const cleanerA1 = await identity('TEAM_LEADER_CLEANER', companyA.id, teamA1.id);
    const cleanerA2 = await identity('TEAM_LEADER_CLEANER', companyA.id, teamA2.id);
    const customer = await identity('CUSTOMER');
    const dispatcher = await identity('DISPATCHER');
    const admin = await identity('HOME_CLEAN_ADMIN');
    const customerRow = await db.customer.findUniqueOrThrow({ where: { userId: customer.user.id } });
    const service = await db.service.create({ data: { code: `P13-S-${suffix}`, name: 'Operational clean', nameAr: 'تنظيف تشغيلي', basePrice: '25.00', durationMinutes: 90, active: true } });
    for (const team of [teamA1, teamA2, teamB]) await db.teamServiceCapability.create({ data: { teamId: team.id, serviceId: service.id } });
    const address = await db.address.create({ data: { customerId: customerRow.id, label: 'Home', addressText: 'Safe operational address', latitude: 31.95, longitude: 35.91 } });
    const property = await db.property.create({ data: { customerId: customerRow.id, type: 'APARTMENT', size: '90.00', rooms: 3, bathrooms: 2 } });
    let counter = 0;
    async function assignment(team: typeof teamA1, status: 'OFFERED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED' | 'COMPLETED' = 'OFFERED', expired = false, cash = false) {
      counter++;
      const startsAt = new Date(Date.now() + counter * 86_400_000);
      const bookingStatus = status === 'OFFERED' ? 'TEAM_ASSIGNED' : status === 'ACCEPTED' ? 'TEAM_ACCEPTED' : status === 'COMPLETED' ? 'CLEANING_COMPLETED' : 'REJECTED';
      const booking = await db.booking.create({ data: {
        bookingNumber: `HC-P13-${suffix}-${counter}`, customerId: customerRow.id, serviceId: service.id, propertyId: property.id, addressId: address.id,
        scheduledAt: startsAt, estimatedEndAt: new Date(startsAt.getTime() + 5_400_000), status: bookingStatus as any,
        paymentMethod: cash ? 'CASH' : 'ONLINE', price: '25.00', currency: 'JOD',
        addressSnapshot: { label: 'Home', addressText: 'Safe operational address', latitude: '31.95', longitude: '35.91' },
        propertySnapshot: { type: 'APARTMENT', size: '90.00', rooms: 3, bathrooms: 2 },
        serviceSnapshot: { name: 'Operational clean', nameAr: 'تنظيف تشغيلي', durationMinutes: 90 },
        locationLatitude: 31.95, locationLongitude: 35.91, instructions: 'Use side entrance',
        extras: { create: [{ name: 'Inside oven', quantity: 1, price: '0.00' }] },
        ...(cash ? { payments: { create: { method: 'CASH', status: 'CONFIRMED', amount: '25.00', currency: 'JOD' } } } : {}),
      } });
      return db.assignment.create({ data: { bookingId: booking.id, companyId: team.companyId, teamId: team.id, status,
        startsAt, endsAt: new Date(startsAt.getTime() + 5_400_000), assignedAt: expired ? new Date(Date.now() - 120_000) : new Date(),
        expiresAt: new Date(Date.now() + (expired ? -60_000 : 600_000)),
        ...(status === 'ACCEPTED' ? { acceptedAt: new Date() } : {}) } });
    }

    const pendingA1 = await assignment(teamA1);
    const pendingA2 = await assignment(teamA2);
    await assignment(teamB);
    const acceptedCash = await assignment(teamA1, 'ACCEPTED', false, true);
    const acceptedCashB = await assignment(teamB, 'ACCEPTED', false, true);
    const rejectedA1 = await assignment(teamA1, 'REJECTED');
    const expiredA1 = await assignment(teamA1, 'OFFERED', true);

    for (const actor of [customer, dispatcher, admin]) assert.equal((await request('GET', '/provider/assignments', actor.token)).status, 403);
    const managerList = await request('GET', '/provider/assignments', managerA.token);
    assert.equal(managerList.status, 200);
    assert.ok(managerList.body.data.some((row: any) => row.id === pendingA1.id));
    assert.ok(managerList.body.data.some((row: any) => row.id === pendingA2.id));
    assert.ok(managerList.body.data.every((row: any) => row.company.id === companyA.id));
    assert.deepEqual((await request('GET', '/provider/assignments?view=PENDING', cleanerA1.token)).body.data.map((row: any) => row.id), [pendingA1.id]);
    assert.equal((await request('GET', '/provider/assignments?view=PENDING', cleanerA2.token)).body.data[0].id, pendingA2.id);
    assert.equal((await request('GET', '/provider/assignments', managerB.token)).body.data.length, 2);
    assert.equal((await request('GET', `/provider/assignments/${pendingA1.id}`, managerB.token)).status, 404);
    assert.equal((await request('GET', `/provider/assignments/${pendingA2.id}`, cleanerA1.token)).status, 404);
    assert.equal((await request('GET', `/provider/assignments/${randomUUID()}`, managerA.token)).status, 404);
    const detail = await request('GET', `/provider/assignments/${pendingA1.id}`, cleanerA1.token);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.team.id, teamA1.id);
    assert.equal(detail.body.data.team.name, 'A One');
    assert.equal(detail.body.data.company.id, companyA.id);
    assert.equal(detail.body.data.service.name, 'Operational clean');
    assert.equal(detail.body.data.property.rooms, 3);
    assert.equal(detail.body.data.customerId, undefined);
    assert.equal(detail.body.data.price, undefined);
    assert.equal(detail.body.data.cash, null);
    const offers = await request('GET', '/dispatch/offers', managerA.token);
    assert.equal(offers.status, 200);
    const targeted = offers.body.data.find((row: any) => row.id === pendingA1.id);
    assert.deepEqual(targeted.team, { id: teamA1.id, name: 'A One' });
    assert.deepEqual(targeted.company, { id: companyA.id, name: 'Provider A' });
    const history = await request('GET', '/provider/assignments?view=HISTORY', cleanerA1.token);
    assert.ok(history.body.data.some((row: any) => row.id === rejectedA1.id && row.status === 'REJECTED'));
    assert.ok(history.body.data.some((row: any) => row.id === expiredA1.id && row.status === 'EXPIRED'));
    assert.equal((await request('GET', '/provider/assignments?status=OFFERED&view=PENDING', managerA.token)).status, 400);

    const acceptAssignment = await assignment(teamA1);
    const firstAccept = await request('POST', `/assignments/${acceptAssignment.id}/accept`, cleanerA1.token, `p13-accept-${suffix}`);
    const duplicateAccept = await request('POST', `/assignments/${acceptAssignment.id}/accept`, cleanerA1.token, `p13-accept-${suffix}`);
    assert.equal(firstAccept.status, 200);
    assert.deepEqual(duplicateAccept.body.data, firstAccept.body.data);
    assert.ok((await request('GET', '/provider/assignments?view=ACTIVE', cleanerA1.token)).body.data.some((row: any) => row.id === acceptAssignment.id));
    const rejectAssignment = await assignment(teamA1);
    const firstReject = await request('POST', `/assignments/${rejectAssignment.id}/reject`, managerA.token, `p13-reject-${suffix}`, { reason: 'Team unavailable' });
    const duplicateReject = await request('POST', `/assignments/${rejectAssignment.id}/reject`, managerA.token, `p13-reject-${suffix}`, { reason: 'Team unavailable' });
    assert.equal(firstReject.status, 200);
    assert.deepEqual(duplicateReject.body.data, firstReject.body.data);
    assert.equal((await request('POST', `/assignments/${pendingA1.id}/accept`, managerB.token, `p13-foreign-${suffix}`)).status, 404);
    assert.equal((await request('POST', `/assignments/${expiredA1.id}/accept`, cleanerA1.token, `p13-expired-a-${suffix}`)).body.error.code, 'ASSIGNMENT_EXPIRED');
    assert.equal((await request('POST', `/assignments/${expiredA1.id}/reject`, cleanerA1.token, `p13-expired-r-${suffix}`, { reason: 'Late' })).body.error.code, 'ASSIGNMENT_EXPIRED');
    const raced = await assignment(teamA1);
    const race = await Promise.all([
      request('POST', `/assignments/${raced.id}/accept`, cleanerA1.token, `p13-race-a-${suffix}`),
      request('POST', `/assignments/${raced.id}/reject`, cleanerA1.token, `p13-race-r-${suffix}`, { reason: 'Race' }),
    ]);
    assert.deepEqual(race.map(row => row.status).sort(), [200, 409]);

    const managerCashDetail = await request('GET', `/provider/assignments/${acceptedCash.id}`, managerA.token);
    assert.equal(managerCashDetail.body.data.cash, null);
    assert.equal((await request('GET', '/provider/cash-worklist', managerA.token)).status, 403);
    const cleanerCashDetail = await request('GET', `/provider/assignments/${acceptedCash.id}`, cleanerA1.token);
    assert.deepEqual(cleanerCashDetail.body.data.cash, { expectedAmount: '25', currency: 'JOD', collectionState: 'EXPECTED', canCollect: false });
    const worklist = await request('GET', '/provider/cash-worklist?state=EXPECTED', cleanerA1.token);
    assert.equal(worklist.status, 200);
    assert.deepEqual(worklist.body.data.map((row: any) => row.id), [acceptedCash.id]);
    const managerRole = await db.role.findUniqueOrThrow({ where: { name: 'COMPANY_MANAGER' } });
    await db.userRole.create({ data: { userId: cleanerA1.user.id, roleId: managerRole.id, companyId: companyB.id } });
    assert.equal((await request('GET', `/provider/assignments/${acceptedCashB.id}`, cleanerA1.token)).body.data.cash, null,
      'cash permission from team A cannot combine with a manager assignment grant for company B');
    assert.deepEqual((await request('GET', '/provider/cash-worklist', cleanerA1.token)).body.data.map((row: any) => row.id), [acceptedCash.id]);
  } finally {
    await app.close();
  }
});
