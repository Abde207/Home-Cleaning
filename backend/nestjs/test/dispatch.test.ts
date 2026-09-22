import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

test('Dispatch uses the Booking assignment boundary with scoped, ranked, historical offers', async () => {
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const { sessionHash } = await import('../dist/auth/authorization.js');
  const { DispatchWorker } = await import('../dist/dispatch/dispatch.worker.js');
  const { DispatchService } = await import('../dist/dispatch/dispatch.service.js');
  const app = await createApp();
  const db = app.get(PrismaService);
  const worker = app.get(DispatchWorker);
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
    async function identity(roleName: string, companyId?: string, teamId?: string) {
      const role = await db.role.findUniqueOrThrow({ where: { name: roleName as any } });
      const user = await db.user.create({ data: { phone: `+d-${randomUUID()}`.slice(0, 20), customer: { create: {} },
        roles: { create: { roleId: role.id, ...(companyId ? { companyId } : {}), ...(teamId ? { teamId } : {}) } } } });
      const token = randomBytes(32).toString('base64url');
      await db.session.create({ data: { userId: user.id, accessTokenHash: sessionHash(token),
        refreshTokenHash: sessionHash(randomBytes(32).toString('hex')),
        accessExpiresAt: new Date(Date.now() + 600_000), expiresAt: new Date(Date.now() + 1_200_000) } });
      return { token, user, customer: await db.customer.findUniqueOrThrow({ where: { userId: user.id } }) };
    }
    async function request(method: string, path: string, token: string, key?: string, body?: unknown) {
      const headers: Record<string, string> = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
      if (key) headers['idempotency-key'] = key;
      const response = await fetch(`${base}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() as any };
    }
    const admin = await identity('HOME_CLEAN_ADMIN');
    const dispatcher = await identity('DISPATCHER');
    const customer = await identity('CUSTOMER');
    const companyA = await db.company.create({ data: { internalCode: `DISP-A-${suffix}`, name: 'A', status: 'ACTIVE', commissionRate: '0.20' } });
    const companyB = await db.company.create({ data: { internalCode: `DISP-B-${suffix}`, name: 'B', status: 'ACTIVE', commissionRate: '0.20' } });
    const near = await db.team.create({ data: { companyId: companyA.id, internalCode: `DISP-T1-${suffix}`, name: 'Near', status: 'AVAILABLE', active: true, capacity: 1,
      latitude: 31.95, longitude: 35.91, locationAt: new Date() } });
    const far = await db.team.create({ data: { companyId: companyB.id, internalCode: `DISP-T2-${suffix}`, name: 'Far', status: 'AVAILABLE', active: true, capacity: 1,
      latitude: 31.98, longitude: 35.94, locationAt: new Date() } });
    const managerA = await identity('COMPANY_MANAGER', companyA.id);
    const cleanerA = await identity('TEAM_LEADER_CLEANER', companyA.id, near.id);
    const cleanerB = await identity('TEAM_LEADER_CLEANER', companyB.id, far.id);
    const service = await db.service.create({ data: { code: `DISP-S-${suffix}`, name: 'Dispatch test', nameAr: 'تنظيف', basePrice: '15.00', durationMinutes: 60, active: true } });
    for (const team of [near, far]) await db.teamServiceCapability.create({ data: { teamId: team.id, serviceId: service.id } });
    for (const company of [companyA, companyB]) await db.companyServiceArea.create({ data: { companyId: company.id, name: 'Test area', latitude: 31.95, longitude: 35.91, radiusKm: 20, active: true } });
    const slots = [7, 8, 9, 10, 11, 12].map(days => {
      const start = new Date(Date.now() + days * 86_400_000);
      start.setUTCHours(10, 0, 0, 0);
      return start;
    });
    for (const team of [near, far]) await db.teamAvailability.create({ data: { teamId: team.id,
      startsAt: new Date(slots[0].getTime() - 86_400_000), endsAt: new Date(slots[5].getTime() + 86_400_000), available: true } });
    const address = await db.address.create({ data: { customerId: customer.customer.id, label: 'Home', addressText: 'Dispatch address', latitude: 31.95, longitude: 35.91 } });
    const property = await db.property.create({ data: { customerId: customer.customer.id, type: 'APARTMENT', size: '80.00', rooms: 2, bathrooms: 1 } });
    async function readyBooking(index: number, label: string = String(index)) {
      const created = await request('POST', '/bookings', customer.token, `d-create-${suffix}-${label}`,
        { serviceId: service.id, propertyId: property.id, addressId: address.id, scheduledAt: slots[index].toISOString(), extras: [] });
      assert.equal(created.status, 201);
      const id = created.body.data.id as string;
      assert.equal((await request('POST', `/bookings/${id}/confirm`, customer.token, `d-confirm-${suffix}-${label}`)).status, 200);
      assert.equal((await request('POST', `/bookings/${id}/select-cash`, customer.token, `d-cash-${suffix}-${label}`)).status, 200);
      assert.equal((await request('POST', `/bookings/${id}/cash-payment-confirmed`, admin.token, `d-payment-${suffix}-${label}`,
        { provider: 'cash-register', eventId: `d-event-${suffix}-${label}`, transactionReference: `d-txn-${suffix}-${label}`, payloadHash: 'a'.repeat(64) })).status, 200);
      return id;
    }
    const statusBooking = await readyBooking(5, 'status-at-accept');
    const statusOffer = await request('POST', `/dispatch/bookings/${statusBooking}/offer`, dispatcher.token, `d-status-offer-${suffix}`);
    assert.equal(statusOffer.status, 200);
    const statusAssignment = statusOffer.body.data.assignments[0].id as string;
    assert.equal(statusOffer.body.data.assignments[0].teamId, near.id);
    assert.equal((await request('PUT', `/provider/teams/${near.id}/availability-status`, cleanerA.token, undefined, { status: 'OFFLINE' })).status, 200);
    const statusAcceptance = await request('POST', `/assignments/${statusAssignment}/accept`, cleanerA.token, `d-status-accept-${suffix}`);
    assert.equal(statusAcceptance.status, 409);
    assert.equal(statusAcceptance.body.error.code, 'TEAM_NOT_OPERATIONAL');
    assert.equal((await db.booking.findUniqueOrThrow({ where: { id: statusBooking } })).status, 'TEAM_ASSIGNED');
    assert.equal((await db.assignment.findUniqueOrThrow({ where: { id: statusAssignment } })).status, 'OFFERED');
    assert.equal(await db.assignmentEvent.count({ where: { assignmentId: statusAssignment, type: 'ACCEPTED' } }), 0);
    assert.equal(await db.bookingStatusHistory.count({ where: { bookingId: statusBooking, newStatus: 'TEAM_ACCEPTED' } }), 0);
    assert.equal(await db.auditLog.count({ where: { resourceId: statusBooking, action: 'BOOKING_TEAM_ACCEPTED' } }), 0);
    assert.equal(await db.auditLog.count({ where: { resourceId: near.id, action: 'TEAM_AVAILABILITY_STATUS_CHANGED', actorUserId: cleanerA.user.id } }), 1);
    assert.equal((await request('PUT', `/provider/teams/${near.id}/availability-status`, cleanerA.token, undefined, { status: 'AVAILABLE' })).status, 200);
    assert.equal((await request('POST', `/assignments/${statusAssignment}/reject`, cleanerA.token, `d-status-reject-${suffix}`, { reason: 'Status changed' })).status, 200);

    const capabilityBooking = await readyBooking(5, 'capability-at-accept');
    const capabilityOffer = await request('POST', `/dispatch/bookings/${capabilityBooking}/offer`, dispatcher.token, `d-capability-offer-${suffix}`);
    assert.equal(capabilityOffer.status, 200);
    const capabilityAssignment = capabilityOffer.body.data.assignments[0].id as string;
    assert.equal(capabilityOffer.body.data.assignments[0].teamId, near.id);
    assert.equal((await request('PUT', `/provider/teams/${near.id}/capabilities`, managerA.token, undefined, { serviceIds: [] })).status, 200);
    const capabilityAcceptance = await request('POST', `/assignments/${capabilityAssignment}/accept`, cleanerA.token, `d-capability-accept-${suffix}`);
    assert.equal(capabilityAcceptance.status, 409);
    assert.equal(capabilityAcceptance.body.error.code, 'TEAM_CAPABILITY_MISMATCH');
    assert.equal((await db.booking.findUniqueOrThrow({ where: { id: capabilityBooking } })).status, 'TEAM_ASSIGNED');
    assert.equal((await db.assignment.findUniqueOrThrow({ where: { id: capabilityAssignment } })).status, 'OFFERED');
    assert.equal(await db.assignmentEvent.count({ where: { assignmentId: capabilityAssignment, type: 'ACCEPTED' } }), 0);
    assert.equal(await db.bookingStatusHistory.count({ where: { bookingId: capabilityBooking, newStatus: 'TEAM_ACCEPTED' } }), 0);
    assert.equal(await db.auditLog.count({ where: { resourceId: near.id, action: 'TEAM_CAPABILITIES_REPLACED', actorUserId: managerA.user.id } }), 1);
    assert.equal((await request('PUT', `/provider/teams/${near.id}/capabilities`, managerA.token, undefined, { serviceIds: [service.id] })).status, 200);
    assert.equal((await request('POST', `/assignments/${capabilityAssignment}/reject`, cleanerA.token, `d-capability-reject-${suffix}`, { reason: 'Capability removed' })).status, 200);
    const first = await readyBooking(0);
    assert.equal((await request('POST', `/dispatch/bookings/${first}/offer`, customer.token, `d-forbid-${suffix}`)).status, 403);
    const offers = await Promise.all([request('POST', `/dispatch/bookings/${first}/offer`, dispatcher.token, `d-offer-${suffix}`),
      request('POST', `/dispatch/bookings/${first}/offer`, dispatcher.token, `d-offer-${suffix}`)]);
    assert.deepEqual(offers.map(row => row.status), [200, 200]);
    assert.equal(offers[0].body.data.assignments[0].id, offers[1].body.data.assignments[0].id);
    assert.equal(offers[0].body.data.assignments[0].teamId, near.id);
    assert.equal(offers[0].body.data.price, undefined);
    assert.equal(offers[0].body.data.payments, undefined);
    assert.equal(offers[0].body.data.customerId, undefined);
    const firstOffer = offers[0].body.data.assignments[0].id as string;
    assert.equal((await request('GET', '/dispatch/offers', customer.token)).status, 403);
    const managerOffers = (await request('GET', '/dispatch/offers', managerA.token)).body.data;
    assert.deepEqual(managerOffers.map((row: any) => row.id), [firstOffer]);
    assert.equal(managerOffers[0].bookingId, first);
    assert.equal(managerOffers[0].service.name, 'Dispatch test');
    assert.equal(managerOffers[0].service.basePrice, undefined);
    assert.equal(managerOffers[0].customerId, undefined);
    assert.equal((await request('GET', '/dispatch/offers', cleanerB.token)).body.data.length, 0);
    assert.equal((await request('POST', `/assignments/${firstOffer}/accept`, cleanerB.token, `d-foreign-${suffix}`)).status, 404);
    const attempt = await db.dispatchAttempt.findFirstOrThrow({ where: { bookingId: first } });
    assert.equal((attempt.candidates as any[])[0].selectedTeamId, near.id);
    assert.equal((attempt.candidates as any[])[0].decisions.length, 2);
    assert.equal((await db.outboxEvent.count({ where: { type: 'ASSIGNMENT_OFFERED', aggregateId: firstOffer } })), 1);
    assert.equal((await request('POST', `/assignments/${firstOffer}/reject`, cleanerA.token, `d-reject-${suffix}`, { reason: 'Cannot attend' })).status, 200);
    assert.equal((await worker.runOnce(first)).succeeded, 1);
    assert.equal((await worker.runOnce(first)).processed, 0, 'completed retry is not replayed');
    const retried = await db.booking.findUniqueOrThrow({ where: { id: first }, include: { assignments: { orderBy: { assignedAt: 'asc' } } } });
    assert.equal(retried.assignments.at(-1)!.teamId, far.id);
    const secondOffer = retried.assignments.at(-1)!.id;
    assert.equal((await request('POST', `/assignments/${secondOffer}/accept`, cleanerB.token, `d-accept-${suffix}`)).status, 200);
    assert.equal((await db.assignment.count({ where: { bookingId: first } })), 2);
    assert.equal((await db.booking.findUniqueOrThrow({ where: { id: first } })).status, 'TEAM_ACCEPTED');
    const acceptedAttempt = await request('POST', `/dispatch/bookings/${first}/manual`, dispatcher.token, `d-accepted-manual-${suffix}`,
      { companyId: companyA.id, teamId: near.id, reason: 'Operations requested a replacement' });
    assert.equal(acceptedAttempt.status, 409);
    assert.equal(acceptedAttempt.body.error.code, 'DISPATCH_ACCEPTED_JOB_REASSIGNMENT_UNSUPPORTED');
    const legacyAccepted = await request('POST', `/bookings/${first}/assign`, dispatcher.token, `d-accepted-legacy-${suffix}`,
      { companyId: companyA.id, teamId: near.id, startsAt: slots[0].toISOString(), endsAt: new Date(slots[0].getTime() + 3_600_000).toISOString(),
        expiresAt: new Date(Date.now() + 300_000).toISOString(), reason: 'Operations requested a replacement' });
    assert.equal(legacyAccepted.body.error.code, 'DISPATCH_ACCEPTED_JOB_REASSIGNMENT_UNSUPPORTED');
    assert.equal((await request('POST', `/assignments/${secondOffer}/on-the-way`, cleanerB.token, `d-way-${suffix}`)).status, 200);
    assert.equal((await request('POST', `/assignments/${secondOffer}/start-cleaning`, cleanerB.token, `d-start-${suffix}`)).status, 200);
    assert.equal((await request('POST', `/dispatch/bookings/${first}/manual`, dispatcher.token, `d-started-manual-${suffix}`,
      { companyId: companyA.id, teamId: near.id, reason: 'Operations requested a replacement' })).body.error.code, 'DISPATCH_ACCEPTED_JOB_REASSIGNMENT_UNSUPPORTED');
    assert.equal((await db.assignment.findUniqueOrThrow({ where: { id: secondOffer } })).status, 'ACCEPTED');
    assert.equal(await db.assignment.count({ where: { bookingId: first } }), 2);
    assert.equal((await request('GET', '/dispatch/monitoring', dispatcher.token)).status, 200);

    const expired = await readyBooking(1);
    const expiredOffer = await request('POST', `/dispatch/bookings/${expired}/offer`, dispatcher.token, `d-expired-offer-${suffix}`);
    assert.equal(expiredOffer.status, 200);
    const expiredId = expiredOffer.body.data.assignments[0].id as string;
    await db.assignment.update({ where: { id: expiredId }, data: { assignedAt: new Date(Date.now() - 120_000), expiresAt: new Date(Date.now() - 60_000) } });
    assert.equal((await request('POST', `/assignments/${expiredId}/accept`, cleanerA.token, `d-late-${suffix}`)).body.error.code, 'ASSIGNMENT_EXPIRED');
    assert.equal((await worker.runOnce(expired)).succeeded, 1);
    const replacement = await db.booking.findUniqueOrThrow({ where: { id: expired }, include: { assignments: { orderBy: { assignedAt: 'asc' } } } });
    assert.equal(replacement.assignments.at(-1)!.teamId, far.id);
    assert.equal((await db.assignment.findUniqueOrThrow({ where: { id: expiredId } })).status, 'EXPIRED');
    assert.equal((await db.auditLog.count({ where: { resourceId: replacement.assignments.at(-1)!.id, action: 'BOOKING_ASSIGNMENT_OFFERED', actorUserId: null } })), 1);
    const legacyDto = { companyId: companyA.id, teamId: near.id, startsAt: slots[1].toISOString(),
      endsAt: new Date(slots[1].getTime() + 3_600_000).toISOString(), expiresAt: new Date(Date.now() + 300_000).toISOString(),
      reason: 'Dispatcher replaces a timed-out offer' };
    assert.equal((await request('POST', `/bookings/${expired}/assign`, customer.token, `d-legacy-customer-${suffix}`, legacyDto)).status, 403);
    assert.equal((await request('POST', `/bookings/${expired}/assign`, managerA.token, `d-legacy-provider-${suffix}`, legacyDto)).status, 403);
    assert.equal((await request('POST', `/bookings/${expired}/assign`, dispatcher.token, `d-legacy-reason-${suffix}`, { ...legacyDto, reason: '   ' })).status, 400);
    const beforeLegacyCount = await db.assignment.count({ where: { bookingId: expired } });
    assert.equal((await request('POST', `/bookings/${expired}/assign`, dispatcher.token, `d-legacy-slot-${suffix}`,
      { ...legacyDto, startsAt: slots[0].toISOString() })).body.error.code, 'ASSIGNMENT_SLOT_MISMATCH');
    assert.equal(await db.assignment.count({ where: { bookingId: expired } }), beforeLegacyCount);
    const legacyResults = await Promise.all([
      request('POST', `/bookings/${expired}/assign`, dispatcher.token, `d-legacy-success-${suffix}`, legacyDto),
      request('POST', `/bookings/${expired}/assign`, dispatcher.token, `d-legacy-success-${suffix}`, legacyDto),
    ]);
    assert.deepEqual(legacyResults.map(row => row.status), [200, 200]);
    assert.equal(legacyResults[0].body.data.assignments.at(-1).id, legacyResults[1].body.data.assignments.at(-1).id);
    assert.equal(legacyResults[0].body.data.price, undefined);
    assert.equal(legacyResults[0].body.data.customerId, undefined);
    const legacyAssignment = legacyResults[0].body.data.assignments.at(-1).id as string;
    assert.equal((await db.assignment.findUniqueOrThrow({ where: { id: replacement.assignments.at(-1)!.id } })).status, 'CANCELLED');
    assert.equal((await db.assignment.findUniqueOrThrow({ where: { id: legacyAssignment } })).reason, legacyDto.reason);
    const legacyAudit = await db.auditLog.findFirstOrThrow({ where: { resourceId: legacyAssignment, action: 'BOOKING_ASSIGNMENT_OFFERED' } });
    assert.equal(legacyAudit.actorUserId, dispatcher.user.id);
    assert.equal((legacyAudit.after as any).reason, legacyDto.reason);
    assert.ok(legacyAudit.createdAt);
    assert.equal((await db.bookingStatusHistory.count({ where: { bookingId: expired, newStatus: 'TEAM_ASSIGNED', reason: legacyDto.reason } })), 1);

    const competingA = await readyBooking(3, 'compete-a');
    const competingB = await readyBooking(3, 'compete-b');
    const competing = await Promise.all([
      request('POST', `/dispatch/bookings/${competingA}/offer`, dispatcher.token, `d-compete-a-${suffix}`),
      request('POST', `/dispatch/bookings/${competingB}/offer`, dispatcher.token, `d-compete-b-${suffix}`),
    ]);
    assert.deepEqual(competing.map(row => row.status), [200, 200]);
    assert.deepEqual(new Set(competing.map(row => row.body.data.assignments[0].teamId)), new Set([near.id, far.id]));

    const manual = await readyBooking(2);
    const offered = await request('POST', `/dispatch/bookings/${manual}/offer`, dispatcher.token, `d-manual-first-${suffix}`);
    const oldId = offered.body.data.assignments[0].id as string;
    await db.companyServiceArea.updateMany({ where: { companyId: companyB.id }, data: { active: false } });
    assert.equal((await request('POST', `/dispatch/bookings/${manual}/manual`, dispatcher.token, `d-manual-denied-${suffix}`,
      { companyId: companyB.id, teamId: far.id, reason: 'Policy check' })).body.error.code, 'MANUAL_TEAM_NOT_ELIGIBLE');
    assert.equal((await db.assignment.findUniqueOrThrow({ where: { id: oldId } })).status, 'OFFERED', 'failed override rolls back cancellation');
    const override = await request('POST', `/dispatch/bookings/${manual}/manual`, dispatcher.token, `d-manual-${suffix}`,
      { companyId: companyB.id, teamId: far.id, reason: 'Operations reassigned pending offer', overrideAvailabilityAndArea: true });
    assert.equal(override.status, 200);
    assert.equal(override.body.data.assignments.at(-1).teamId, far.id);
    assert.equal((await db.assignment.findUniqueOrThrow({ where: { id: oldId } })).status, 'CANCELLED');
    assert.equal((await db.assignmentEvent.count({ where: { assignmentId: oldId, type: 'MANUAL_REASSIGNED' } })), 1);
    assert.equal((await db.assignment.findUniqueOrThrow({ where: { id: oldId } })).reason, 'Operations reassigned pending offer');
    const reassignAudit = await db.auditLog.findFirstOrThrow({ where: { resourceId: oldId, action: 'BOOKING_MANUAL_REASSIGNED' } });
    assert.equal(reassignAudit.actorUserId, dispatcher.user.id);
    assert.equal((reassignAudit.after as any).reason, 'Operations reassigned pending offer');
    assert.equal((await request('POST', `/dispatch/bookings/${manual}/manual`, dispatcher.token, `d-manual-${suffix}`,
      { companyId: companyB.id, teamId: far.id, reason: 'Different reason' })).status, 409);
    const noTeam = await readyBooking(3, 'capacity-exhausted');
    const exhausted = await request('POST', `/dispatch/bookings/${noTeam}/offer`, dispatcher.token, `d-none-${suffix}`);
    assert.equal(exhausted.status, 200);
    assert.equal(exhausted.body.data.status, 'NO_TEAM_AVAILABLE');
    const noTeamAttempt = await db.dispatchAttempt.findFirstOrThrow({ where: { bookingId: noTeam } });
    assert.equal(noTeamAttempt.outcome, 'NO_TEAM_AVAILABLE');
    assert.equal((noTeamAttempt.candidates as any[])[0].decisions.length, 2);
    assert.equal((await db.auditLog.count({ where: { resourceId: noTeam, action: 'DISPATCH_NO_TEAM_AVAILABLE' } })), 1);
    const noTeamHistory = await db.bookingStatusHistory.count({ where: { bookingId: noTeam } });
    const noTeamAssignments = await db.assignment.count({ where: { bookingId: noTeam } });
    assert.equal((await request('POST', `/dispatch/bookings/${noTeam}/manual`, dispatcher.token, `d-terminal-manual-${suffix}`,
      { companyId: companyA.id, teamId: near.id, reason: 'Operations review after exhaustion' })).body.error.code, 'DISPATCH_TERMINAL_NO_TEAM_AVAILABLE');
    assert.equal((await request('POST', `/bookings/${noTeam}/assign`, dispatcher.token, `d-terminal-legacy-${suffix}`,
      { ...legacyDto, startsAt: slots[3].toISOString(), endsAt: new Date(slots[3].getTime() + 3_600_000).toISOString(),
        reason: 'Operations review after exhaustion' })).body.error.code, 'DISPATCH_TERMINAL_NO_TEAM_AVAILABLE');
    assert.equal((await request('POST', `/bookings/${noTeam}/retry-assignment`, dispatcher.token, `d-terminal-retry-${suffix}`)).status, 409);
    assert.equal(await db.bookingStatusHistory.count({ where: { bookingId: noTeam } }), noTeamHistory);
    assert.equal(await db.assignment.count({ where: { bookingId: noTeam } }), noTeamAssignments);
    await db.companyServiceArea.updateMany({ where: { companyId: companyB.id }, data: { active: true } });
    const companyC = await db.company.create({ data: { internalCode: `DISP-C-${suffix}`, name: 'C', status: 'ACTIVE', commissionRate: '0.20' } });
    const third = await db.team.create({ data: { companyId: companyC.id, internalCode: `DISP-T3-${suffix}`, name: 'Third', status: 'AVAILABLE', active: true, capacity: 1,
      latitude: 32.0, longitude: 35.96, locationAt: new Date() } });
    const cleanerC = await identity('TEAM_LEADER_CLEANER', companyC.id, third.id);
    await db.teamServiceCapability.create({ data: { teamId: third.id, serviceId: service.id } });
    await db.companyServiceArea.create({ data: { companyId: companyC.id, name: 'Test area C', latitude: 31.95, longitude: 35.91, radiusKm: 20, active: true } });
    await db.teamAvailability.create({ data: { teamId: third.id, startsAt: new Date(slots[4].getTime() - 86_400_000),
      endsAt: new Date(slots[4].getTime() + 86_400_000), available: true } });
    const limited = await readyBooking(4);
    const cleaners = new Map([[near.id, cleanerA.token], [far.id, cleanerB.token], [third.id, cleanerC.token]]);
    let limitResult = await request('POST', `/dispatch/bookings/${limited}/offer`, dispatcher.token, `d-limit-first-${suffix}`);
    assert.equal(limitResult.status, 200);
    for (let index = 0; index < 3; index++) {
      const active = limitResult.body.data.assignments.at(-1);
      assert.equal((await request('POST', `/assignments/${active.id}/reject`, cleaners.get(active.teamId)!, `d-limit-reject-${suffix}-${index}`, { reason: 'Cannot take job' })).status, 200);
      assert.equal((await worker.runOnce(limited)).succeeded, 1);
      const current = await db.booking.findUniqueOrThrow({ where: { id: limited }, include: { assignments: { orderBy: { assignedAt: 'asc' } } } });
      limitResult = { status: 200, body: { data: current } };
    }
    assert.equal(limitResult.body.data.status, 'NO_TEAM_AVAILABLE');
    assert.equal((await db.dispatchAttempt.findFirstOrThrow({ where: { bookingId: limited }, orderBy: { sequence: 'desc' } })).reason, 'RETRY_LIMIT_REACHED');
    assert.equal(await db.assignment.count({ where: { bookingId: limited } }), 3);
    const rollback = await readyBooking(4, 'rollback');
    await db.$executeRawUnsafe(`CREATE FUNCTION dispatch_test_outbox_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type = 'ASSIGNMENT_OFFERED' AND NEW.payload->>'bookingId' = '${rollback}' THEN RAISE EXCEPTION 'injected dispatch outbox failure'; END IF; RETURN NEW; END; $$;`);
    await db.$executeRawUnsafe(`CREATE TRIGGER dispatch_test_outbox_failure BEFORE INSERT ON "OutboxEvent" FOR EACH ROW EXECUTE FUNCTION dispatch_test_outbox_failure();`);
    try {
      assert.equal((await request('POST', `/dispatch/bookings/${rollback}/offer`, dispatcher.token, `d-rollback-${suffix}`)).status, 500);
      assert.equal((await db.booking.findUniqueOrThrow({ where: { id: rollback } })).status, 'PAYMENT_CONFIRMED');
      assert.equal(await db.assignment.count({ where: { bookingId: rollback } }), 0);
      assert.equal(await db.dispatchAttempt.count({ where: { bookingId: rollback } }), 0);
      assert.equal(await db.bookingStatusHistory.count({ where: { bookingId: rollback, newStatus: 'SEARCHING_FOR_TEAM' } }), 0);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER dispatch_test_outbox_failure ON "OutboxEvent"`);
      await db.$executeRawUnsafe(`DROP FUNCTION dispatch_test_outbox_failure()`);
    }
    assert.equal((await request('POST', `/dispatch/bookings/${rollback}/offer`, dispatcher.token, `d-rollback-${suffix}`)).status, 200,
      'the same idempotency key can retry after a fully rolled-back attempt');
    const multi = await readyBooking(4, 'multi-instance');
    const dispatch = app.get(DispatchService);
    const workerA = new DispatchWorker(db, dispatch);
    const workerB = new DispatchWorker(db, dispatch);
    const sweeps = await Promise.all([workerA.runOnce(multi), workerB.runOnce(multi)]);
    assert.equal(sweeps.reduce((sum, row) => sum + row.succeeded, 0), 1);
    assert.equal(await db.assignment.count({ where: { bookingId: multi } }), 1);
    assert.equal((await db.booking.findUniqueOrThrow({ where: { id: multi } })).status, 'TEAM_ASSIGNED');
    const recovery = await readyBooking(1, 'worker-recovery');
    const failingWorker = new DispatchWorker(db, { systemOffer: async () => { throw new Error('worker instance failed before offer'); } } as any);
    const recoveryWorker = new DispatchWorker(db, dispatch);
    const recovered = await Promise.all([failingWorker.runOnce(recovery), recoveryWorker.runOnce(recovery)]);
    assert.deepEqual(recovered.map(row => [row.succeeded, row.failed]), [[0, 1], [1, 0]]);
    assert.equal(await db.assignment.count({ where: { bookingId: recovery } }), 1);
    assert.equal((await db.booking.findUniqueOrThrow({ where: { id: recovery } })).status, 'TEAM_ASSIGNED');
    const timerBooking = await readyBooking(2, 'timer');
    const timerWorker = new DispatchWorker({ booking: { findMany: async () => [{ id: timerBooking }] } } as any, dispatch);
    const previousNodeEnv = process.env.NODE_ENV;
    const previousEnabled = process.env.DISPATCH_WORKER_ENABLED;
    try {
      process.env.NODE_ENV = 'production';
      process.env.DISPATCH_WORKER_ENABLED = 'true';
      timerWorker.onModuleInit();
      const deadline = Date.now() + 16_000;
      while (Date.now() < deadline && await db.assignment.count({ where: { bookingId: timerBooking } }) === 0)
        await new Promise(resolve => setTimeout(resolve, 250));
      assert.equal(await db.assignment.count({ where: { bookingId: timerBooking } }), 1, 'production timer ran a real dispatch offer');
    } finally {
      timerWorker.onModuleDestroy();
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
      if (previousEnabled === undefined) delete process.env.DISPATCH_WORKER_ENABLED; else process.env.DISPATCH_WORKER_ENABLED = previousEnabled;
    }
    const distinctKeysBooking = await readyBooking(5, 'different-manual-keys');
    const manualKeys = [`d-concurrent-near-${suffix}`, `d-concurrent-far-${suffix}`];
    let pendingManual: Promise<{ status: number; body: any }>[] = [];
    let manualRace: { status: number; body: any }[];
    try {
      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${distinctKeysBooking}::uuid FOR UPDATE`;
        pendingManual = [
          request('POST', `/dispatch/bookings/${distinctKeysBooking}/manual`, dispatcher.token, manualKeys[0],
            { companyId: companyA.id, teamId: near.id, reason: 'Concurrent near team' }),
          request('POST', `/dispatch/bookings/${distinctKeysBooking}/manual`, dispatcher.token, manualKeys[1],
            { companyId: companyB.id, teamId: far.id, reason: 'Concurrent far team' }),
        ];
        let blocked = 0;
        const deadline = Date.now() + 5_000;
        while (Date.now() < deadline) {
          const rows = await db.$queryRaw<{ count: bigint }[]>`SELECT count(*)::bigint AS count FROM pg_stat_activity
            WHERE wait_event_type = 'Lock' AND query LIKE '%"Booking"%FOR UPDATE%'`;
          blocked = Number(rows[0].count);
          if (blocked >= 2) break;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.ok(blocked >= 2, 'both different-key callers reached the Booking row lock');
      });
      manualRace = await Promise.all(pendingManual);
    } finally { await Promise.allSettled(pendingManual); }
    assert.deepEqual(manualRace.map(row => row.status).sort(), [200, 409]);
    assert.equal(manualRace.find(row => row.status === 409)!.body.error.code, 'BOOKING_CONCURRENT_MODIFICATION');
    assert.equal(await db.assignment.count({ where: { bookingId: distinctKeysBooking } }), 1);
    assert.equal(await db.dispatchAttempt.count({ where: { bookingId: distinctKeysBooking, outcome: 'ASSIGNMENT_OFFERED' } }), 1);
    assert.equal((await db.booking.findUniqueOrThrow({ where: { id: distinctKeysBooking } })).status, 'TEAM_ASSIGNED');
    assert.equal(await db.bookingStatusHistory.count({ where: { bookingId: distinctKeysBooking, newStatus: 'SEARCHING_FOR_TEAM' } }), 1);
    assert.equal(await db.bookingStatusHistory.count({ where: { bookingId: distinctKeysBooking, newStatus: 'TEAM_ASSIGNED' } }), 1);
    const onlyAssignment = await db.assignment.findFirstOrThrow({ where: { bookingId: distinctKeysBooking } });
    assert.equal(await db.auditLog.count({ where: { resourceId: onlyAssignment.id, action: 'BOOKING_ASSIGNMENT_OFFERED', actorUserId: dispatcher.user.id } }), 1);
    assert.equal(await db.idempotencyKey.count({ where: { key: { in: manualKeys }, operation: 'DISPATCH_MANUAL' } }), 1);
    assert.equal((await db.payment.count({ where: { bookingId: manual } })), 1);
    assert.equal((await db.auditLog.count({ where: { action: 'BOOKING_ASSIGNMENT_OFFERED', resourceType: 'Assignment' } })) >= 4, true);
  } finally { await app.close(); }
});
