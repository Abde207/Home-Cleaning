import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';

test('HTTP infrastructure exposes readiness, headers and safe error envelopes', async () => {
  // Import compiled decorators/metadata, exactly as the production entry point does.
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const app = await createApp();
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const response = await fetch(`${base}/api/v1/health/ready`, { headers: { 'x-request-id': 'test-request', origin: 'http://localhost:3000' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-request-id'), 'test-request');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:3000');
    assert.deepEqual(await response.json(), { success: true, data: { status: 'ready' }, meta: { requestId: 'test-request' } });
    const missing = await fetch(`${base}/api/v1/missing`, { headers: { origin: 'https://untrusted.example' } });
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get('access-control-allow-origin'), null);
    assert.equal((await missing.json()).error.code, 'RESOURCE_NOT_FOUND');
    const malformed = await fetch(`${base}/api/v1/health/live`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{broken' });
    assert.equal(malformed.status, 400);
    assert.doesNotMatch(await malformed.text(), /broken|SyntaxError/);
    const db = app.get(PrismaService);
    const original = db.$queryRaw;
    db.$queryRaw = () => Promise.reject(new Error('secret-database-credentials'));
    const unavailable = await fetch(`${base}/api/v1/health/ready`);
    assert.equal(unavailable.status, 503);
    assert.doesNotMatch(await unavailable.text(), /secret-database-credentials/);
    db.$queryRaw = original;
  } finally { await app.close(); }
});
