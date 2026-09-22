import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

test('separate Dispatch processes converge, recover after termination, and sustain timer retries', async () => {
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const { RedisService } = await import('../dist/redis/redis.module.js');
  const { sessionHash } = await import('../dist/auth/authorization.js');
  const app = await createApp();
  const db = app.get(PrismaService);
  const bridge = process.env.DISPATCH_EXTERNAL_WORKERS_DIR;
  type WorkerHandle = { id: string; child?: ChildProcess; messages: any[]; readEvents: number; output: string; error?: Error; exited: boolean };
  const workers: WorkerHandle[] = [];
  let triggerCreated = false;
  async function waitFor<T>(read: () => T | undefined | false, label: string, timeoutMs = 18_000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (bridge) for (const worker of workers) {
        const events = join(bridge, `events-${worker.id}.jsonl`);
        if (existsSync(events)) {
          const lines = readFileSync(events, 'utf8').trim().split('\n').filter(Boolean);
          for (const line of lines.slice(worker.readEvents)) worker.messages.push(JSON.parse(line));
          worker.readEvents = lines.length;
        }
        if (existsSync(join(bridge, `killed-${worker.id}.txt`))) worker.exited = true;
      }
      const result = read();
      if (result) return result;
      const failed = workers.find(worker => worker.error);
      if (failed) throw failed.error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for ${label}. Worker output: ${workers.map(w => w.output).join('\n').slice(-3000)}`);
  }
  async function startWorker(mode: 'normal' | 'park', timer = false) {
    if (bridge) {
      const id = randomUUID().replaceAll('-', '');
      const handle: WorkerHandle = { id, messages: [], readEvents: 0, output: '', exited: false };
      workers.push(handle);
      writeFileSync(join(bridge, `start-${id}.json`), JSON.stringify({ id, mode, timer }));
      await waitFor(() => handle.messages.find(message => message.type === 'ready'), 'external worker ready', 15_000);
      return handle;
    }
    const child = spawn(process.execPath, ['test/helpers/dispatch-worker-process.mjs'], {
      cwd: process.cwd(), env: { ...process.env, NODE_ENV: timer ? 'development' : 'test',
        DISPATCH_WORKER_ENABLED: 'true', DISPATCH_PROCESS_TEST_MODE: mode }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    const handle: WorkerHandle = { id: randomUUID(), child, messages: [], readEvents: 0, output: '', exited: false };
    workers.push(handle);
    child.on('message', message => handle.messages.push(message));
    child.on('error', error => { handle.error = error; });
    child.on('exit', () => { handle.exited = true; });
    child.stdout?.on('data', data => { handle.output += data.toString(); });
    child.stderr?.on('data', data => { handle.output += data.toString(); });
    await waitFor(() => handle.messages.find(message => message.type === 'ready'), 'worker ready', 10_000);
    return handle;
  }
  async function terminate(worker: WorkerHandle) {
    if (bridge && !worker.exited) writeFileSync(join(bridge, `kill-${worker.id}.txt`), 'kill');
    else if (!worker.exited) worker.child!.kill();
    await waitFor(() => worker.exited, 'worker exit', 5_000);
  }
  function sweep(worker: WorkerHandle, bookingId: string) {
    if (bridge) appendFileSync(join(bridge, `commands-${worker.id}.jsonl`), `${JSON.stringify({ type: 'sweep', bookingId })}\n`);
    else worker.child!.send({ type: 'sweep', bookingId });
  }
  try {
    await app.listen(0, '127.0.0.1');
    assert.equal(await app.get(RedisService).client.ping(), 'PONG');
    assert.equal((await db.$queryRaw<{ version: string }[]>`SELECT version() AS version`)[0].version.includes('PostgreSQL'), true);
    const base = `${await app.getUrl()}/api/v1`;
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
    async function identity(roleName: string, companyId?: string, teamId?: string) {
      const role = await db.role.findUniqueOrThrow({ where: { name: roleName as any } });
      const user = await db.user.create({ data: { phone: `+proc-${randomUUID()}`.slice(0, 20), customer: { create: {} },
        roles: { create: { roleId: role.id, ...(companyId ? { companyId } : {}), ...(teamId ? { teamId } : {}) } } } });
      const token = randomBytes(32).toString('base64url');
      await db.session.create({ data: { userId: user.id, accessTokenHash: sessionHash(token),
        refreshTokenHash: sessionHash(randomBytes(32).toString('hex')),
        accessExpiresAt: new Date(Date.now() + 600_000), expiresAt: new Date(Date.now() + 1_200_000) } });
      return { token, user, customer: await db.customer.findUniqueOrThrow({ where: { userId: user.id } }) };
    }
    async function request(method: string, path: string, token: string, key: string, body?: unknown) {
      const response = await fetch(`${base}${path}`, { method,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() as any };
    }
    const admin = await identity('HOME_CLEAN_ADMIN');
    const customer = await identity('CUSTOMER');
    const company = await db.company.create({ data: { internalCode: `PROC-C-${suffix}`, name: 'Worker process company', status: 'ACTIVE', commissionRate: '0.20' } });
    const service = await db.service.create({ data: { code: `PROC-S-${suffix}`, name: 'Worker process service', nameAr: 'تنظيف', basePrice: '15.00', durationMinutes: 60, active: true } });
    const teams = [];
    const cleaners = new Map<string, string>();
    const start = new Date(Date.now() + 7 * 86_400_000); start.setUTCHours(10, 0, 0, 0);
    for (let index = 0; index < 3; index++) {
      const team = await db.team.create({ data: { companyId: company.id, internalCode: `PROC-T${index}-${suffix}`, name: `Worker team ${index}`,
        status: 'AVAILABLE', active: true, capacity: 1, latitude: 31.95 + index * 0.01, longitude: 35.91 + index * 0.01, locationAt: new Date() } });
      teams.push(team);
      cleaners.set(team.id, (await identity('TEAM_LEADER_CLEANER', company.id, team.id)).token);
      await db.teamServiceCapability.create({ data: { teamId: team.id, serviceId: service.id } });
      await db.teamAvailability.create({ data: { teamId: team.id,
        startsAt: new Date(start.getTime() - 86_400_000), endsAt: new Date(start.getTime() + 6 * 86_400_000), available: true } });
    }
    await db.companyServiceArea.create({ data: { companyId: company.id, name: 'Worker area', latitude: 31.95, longitude: 35.91, radiusKm: 20, active: true } });
    const address = await db.address.create({ data: { customerId: customer.customer.id, label: 'Home', addressText: 'Worker test address', latitude: 31.95, longitude: 35.91 } });
    const property = await db.property.create({ data: { customerId: customer.customer.id, type: 'APARTMENT', size: '80.00', rooms: 2, bathrooms: 1 } });
    async function readyBooking(day: number, label: string) {
      const scheduledAt = new Date(start.getTime() + day * 86_400_000).toISOString();
      const created = await request('POST', '/bookings', customer.token, `proc-create-${suffix}-${label}`,
        { serviceId: service.id, propertyId: property.id, addressId: address.id, scheduledAt, extras: [] });
      assert.equal(created.status, 201);
      const id = created.body.data.id as string;
      assert.equal((await request('POST', `/bookings/${id}/confirm`, customer.token, `proc-confirm-${suffix}-${label}`)).status, 200);
      assert.equal((await request('POST', `/bookings/${id}/select-cash`, customer.token, `proc-cash-${suffix}-${label}`)).status, 200);
      assert.equal((await request('POST', `/bookings/${id}/cash-payment-confirmed`, admin.token, `proc-pay-${suffix}-${label}`,
        { provider: 'cash-register', eventId: `proc-event-${suffix}-${label}`, transactionReference: `proc-txn-${suffix}-${label}`, payloadHash: 'a'.repeat(64) })).status, 200);
      return id;
    }
    const competing = await readyBooking(0, 'competing');
    const workerA = await startWorker('normal');
    const workerB = await startWorker('normal');
    sweep(workerA, competing);
    sweep(workerB, competing);
    await waitFor(() => workerA.messages.find(message => message.type === 'sweep-result' && message.bookingId === competing), 'worker A sweep');
    await waitFor(() => workerB.messages.find(message => message.type === 'sweep-result' && message.bookingId === competing), 'worker B sweep');
    const results = [workerA, workerB].map(worker => worker.messages.find(message => message.type === 'sweep-result' && message.bookingId === competing).result);
    assert.equal(results.reduce((sum, result) => sum + result.succeeded, 0), 1);
    assert.equal(await db.assignment.count({ where: { bookingId: competing } }), 1);
    assert.equal(await db.bookingStatusHistory.count({ where: { bookingId: competing, newStatus: 'TEAM_ASSIGNED' } }), 1);
    assert.equal(await db.auditLog.count({ where: { action: 'BOOKING_ASSIGNMENT_OFFERED', resourceType: 'Assignment', after: { path: ['bookingId'], equals: competing } } }), 1);

    const interrupted = await readyBooking(1, 'interrupted');
    const parked = await startWorker('park');
    sweep(parked, interrupted);
    await waitFor(() => parked.messages.find(message => message.type === 'processing' && message.bookingId === interrupted), 'paused worker processing');
    assert.equal(await db.assignment.count({ where: { bookingId: interrupted } }), 0);
    await terminate(parked);
    sweep(workerB, interrupted);
    const recovered = await waitFor(() => workerB.messages.find(message => message.type === 'sweep-result' && message.bookingId === interrupted), 'surviving worker sweep');
    assert.equal(recovered.result.succeeded, 1);
    assert.equal(await db.assignment.count({ where: { bookingId: interrupted } }), 1);
    const replacement = await startWorker('normal');
    sweep(replacement, interrupted);
    const restarted = await waitFor(() => replacement.messages.find(message => message.type === 'sweep-result' && message.bookingId === interrupted), 'restarted worker sweep');
    assert.equal(restarted.result.processed, 0);
    assert.equal(await db.assignment.count({ where: { bookingId: interrupted } }), 1);
    assert.equal((await db.booking.findUniqueOrThrow({ where: { id: interrupted } })).status, 'TEAM_ASSIGNED');
    for (const worker of [workerA, workerB, replacement]) await terminate(worker);

    const retryBooking = await readyBooking(2, 'timer-retry');
    const faultBooking = await readyBooking(3, 'timer-fault');
    await db.$executeRawUnsafe(`CREATE FUNCTION dispatch_process_outbox_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type = 'ASSIGNMENT_OFFERED' AND NEW.payload->>'bookingId' = '${faultBooking}' THEN RAISE EXCEPTION 'injected process outbox failure'; END IF; RETURN NEW; END; $$;`);
    await db.$executeRawUnsafe('CREATE TRIGGER dispatch_process_outbox_failure BEFORE INSERT ON "OutboxEvent" FOR EACH ROW EXECUTE FUNCTION dispatch_process_outbox_failure();');
    triggerCreated = true;
    const timerWorker = await startWorker('normal', true);
    await waitFor(() => timerWorker.messages.find(message => message.type === 'offer-result' && message.bookingId === retryBooking && message.ok), 'first timer offer');
    await waitFor(() => timerWorker.messages.find(message => message.type === 'offer-result' && message.bookingId === faultBooking && !message.ok), 'injected timer failure');
    assert.equal(await db.assignment.count({ where: { bookingId: faultBooking } }), 0);
    assert.equal((await db.booking.findUniqueOrThrow({ where: { id: faultBooking } })).status, 'PAYMENT_CONFIRMED');
    await db.$executeRawUnsafe('DROP TRIGGER dispatch_process_outbox_failure ON "OutboxEvent"');
    await db.$executeRawUnsafe('DROP FUNCTION dispatch_process_outbox_failure()');
    triggerCreated = false;
    let assignments = await db.assignment.findMany({ where: { bookingId: retryBooking }, orderBy: { assignedAt: 'asc' } });
    assert.equal(assignments.length, 1);
    assert.equal((await request('POST', `/assignments/${assignments[0].id}/reject`, cleaners.get(assignments[0].teamId)!, `proc-reject-${suffix}`, { reason: 'Cannot attend' })).status, 200);
    await waitFor(() => timerWorker.messages.filter(message => message.type === 'offer-result' && message.bookingId === retryBooking && message.ok).length >= 2, 'rejection retry timer offer');
    await waitFor(() => timerWorker.messages.find(message => message.type === 'offer-result' && message.bookingId === faultBooking && message.ok), 'fault recovery timer offer');
    assignments = await db.assignment.findMany({ where: { bookingId: retryBooking }, orderBy: { assignedAt: 'asc' } });
    assert.equal(assignments.length, 2);
    assert.notEqual(assignments[0].teamId, assignments[1].teamId);
    assert.equal(assignments[0].status, 'REJECTED');
    const rejectedId = assignments[0].id;
    const expiredId = assignments[1].id;
    await db.assignment.update({ where: { id: assignments[1].id }, data: { assignedAt: new Date(Date.now() - 120_000), expiresAt: new Date(Date.now() - 60_000) } });
    await waitFor(() => timerWorker.messages.filter(message => message.type === 'offer-result' && message.bookingId === retryBooking && message.ok).length >= 3, 'expiry retry timer offer');
    assignments = await db.assignment.findMany({ where: { bookingId: retryBooking }, orderBy: { assignedAt: 'asc' } });
    assert.equal(assignments.length, 3);
    assert.equal(assignments.find(row => row.id === rejectedId)!.status, 'REJECTED');
    assert.equal(assignments.find(row => row.id === expiredId)!.status, 'EXPIRED');
    assert.equal(assignments.find(row => row.id !== rejectedId && row.id !== expiredId)!.status, 'OFFERED');
    assert.equal(new Set(assignments.map(row => row.teamId)).size, 3);
    assert.equal(await db.assignment.count({ where: { bookingId: faultBooking } }), 1);
    assert.equal(await db.auditLog.count({ where: { actorUserId: null, action: 'BOOKING_ASSIGNMENT_OFFERED', resourceType: 'Assignment', resourceId: { in: assignments.map(row => row.id) } } }), 3);
    assert.equal(await db.bookingStatusHistory.count({ where: { bookingId: retryBooking, newStatus: 'TEAM_ASSIGNED' } }), 3);
    await terminate(timerWorker);
  } finally {
    for (const worker of workers) if (!worker.exited) {
      if (bridge) writeFileSync(join(bridge, `kill-${worker.id}.txt`), 'kill');
      else worker.child!.kill();
    }
    if (triggerCreated) {
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS dispatch_process_outbox_failure ON "OutboxEvent"');
      await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS dispatch_process_outbox_failure()');
    }
    await app.close();
  }
});
