import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import pg from 'pg';
import Redis from 'ioredis';

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 3000, retryStrategy: () => null });
const children = [];
async function waitFor(url, verify) {
  for (let attempt = 0; attempt < 50; attempt++) {
    try { const response = await fetch(url); if (response.ok) { await verify(response); return; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Service did not become ready: ${url}`);
}
try {
  await db.connect();
  assert.equal((await db.query('SELECT current_database() AS name')).rows[0].name, 'homeclean');
  await redis.connect();
  assert.equal(await redis.ping(), 'PONG');
  console.log('PASS PostgreSQL authenticated query and Redis PING');
  children.push(spawn(process.execPath, ['backend/nestjs/dist/main.js'], { env: { ...process.env, PORT: '3101' }, stdio: 'pipe' }));
  children.push(spawn(process.execPath, ['../../node_modules/next/dist/bin/next', 'start', '-p', '3100', '-H', '127.0.0.1'], { cwd: 'admin/nextjs', env: { ...process.env, NODE_ENV: 'production' }, stdio: 'pipe' }));
  for (const child of children) child.stderr.on('data', chunk => process.stderr.write(chunk));
  await waitFor('http://127.0.0.1:3101/api/v1/health/live', async r => assert.equal((await r.json()).data.status, 'ok'));
  await waitFor('http://127.0.0.1:3100', async r => assert.match(await r.text(), /Home Clean Operations/));
  console.log('PASS NestJS HTTP liveness and Next.js HTTP startup');
} finally {
  for (const child of children) child.kill();
  await db.end();
  redis.disconnect();
}
