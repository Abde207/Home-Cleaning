import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomInt } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('OTP authentication, lockout, role injection rejection, rotation replay and logout', async () => {
  process.env.OTP_HASH_SECRET = randomBytes(32).toString('hex');
  process.env.OTP_DELIVERY_MODE = 'file';
  process.env.NODE_ENV = 'test';
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const app = await createApp();
  const files: string[] = [];
  const phones: string[] = [];
  const db = app.get(PrismaService);
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    async function post(path: string, body: unknown, token?: string) {
      const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() as any };
    }
    async function requestCode() {
      const phone = `+96279${randomInt(1_000_000, 9_999_999)}`;
      phones.push(phone);
      const response = await post('/auth/request-otp', { phone });
      assert.equal(response.status, 202);
      assert.equal(response.body.data.code, undefined);
      const challengeId = response.body.data.challengeId;
      const file = fileURLToPath(new URL(`../../../.local/otp/${challengeId}.json`, import.meta.url));
      files.push(file);
      const code = JSON.parse(await readFile(file, 'utf8')).code;
      return { challengeId, code, phone };
    }
    assert.equal((await fetch(`${base}/auth/me`)).status, 401);
    assert.equal((await post('/auth/request-otp', { phone: '+962790000000', role: 'HOME_CLEAN_ADMIN' })).status, 400);
    const first = await requestCode();
    assert.equal((await post('/auth/admin/verify-otp', { challengeId: first.challengeId, code: first.code })).status, 401);
    assert.equal((await post('/auth/provider/verify-otp', { challengeId: first.challengeId, code: first.code })).status, 401);
    assert.equal((await post('/auth/admin/request-otp', { phone: first.phone })).status, 401);
    assert.equal((await post('/auth/provider/request-otp', { phone: first.phone })).status, 401);
    const success = await post('/auth/verify-otp', { challengeId: first.challengeId, code: first.code });
    assert.equal(success.status, 200);
    const tokens = success.body.data;
    const me = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${tokens.accessToken}` } });
    const profile = await me.json() as any;
    assert.equal(me.status, 200);
    assert.deepEqual(profile.data.scopes.map((s: any) => s.role), ['CUSTOMER']);
    assert.equal((await post('/auth/verify-otp', { challengeId: first.challengeId, code: first.code })).status, 401);
    const refreshed = await post('/auth/refresh', { refreshToken: tokens.refreshToken });
    assert.equal(refreshed.status, 200);
    assert.equal((await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${tokens.accessToken}` } })).status, 401);
    assert.equal((await post('/auth/refresh', { refreshToken: tokens.refreshToken })).status, 401);
    assert.equal((await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${refreshed.body.data.accessToken}` } })).status, 401);
    const locked = await requestCode();
    const wrongCode = locked.code === '000000' ? '000001' : '000000';
    for (let attempt = 0; attempt < 5; attempt++) assert.equal((await post('/auth/verify-otp', { challengeId: locked.challengeId, code: wrongCode })).status, 401);
    assert.equal((await post('/auth/verify-otp', { challengeId: locked.challengeId, code: locked.code })).status, 401);
    assert.equal((await db.otpChallenge.findUniqueOrThrow({ where: { id: locked.challengeId } })).attempts, 5);
    const expired = await requestCode();
    await db.otpChallenge.update({ where: { id: expired.challengeId }, data: { createdAt: new Date(Date.now() - 600_000), expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await post('/auth/verify-otp', { challengeId: expired.challengeId, code: expired.code })).status, 401);
    const last = await requestCode();
    const login = await post('/auth/verify-otp', { challengeId: last.challengeId, code: last.code });
    assert.equal(login.status, 200);
    assert.equal((await post('/auth/logout', {}, login.body.data.accessToken)).status, 200);
    assert.equal((await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${login.body.data.accessToken}` } })).status, 401);
  } finally {
    // Delete only this test's generated identities, never any operational records.
    const users = await db.user.findMany({ where: { phone: { in: phones } }, select: { id: true } });
    const ids = users.map((u: any) => u.id);
    await db.session.deleteMany({ where: { userId: { in: ids } } });
    await db.userRole.deleteMany({ where: { userId: { in: ids } } });
    await db.customer.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.otpChallenge.deleteMany({ where: { phone: { in: phones } } });
    for (const file of files) await unlink(file).catch(() => {});
    await app.close();
  }
});
