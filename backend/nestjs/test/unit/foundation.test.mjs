import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validateEnvironment } from '../../dist/config/environment.js';
import { assignmentScope, companyScope, hasPlatformPermission, AuthGuard, sessionHash } from '../../dist/auth/authorization.js';
import { Reflector } from '@nestjs/core';
import { AdminServicesController } from '../../dist/core/services.controller.js';

// These checks use compiled application code and need no live services or TS loader.
test('configuration rejects absent dependencies and unsafe production origins', () => {
  const valid = { NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost/test', REDIS_URL: 'redis://localhost:6379', CORS_ORIGINS: 'http://localhost:3000', OTP_HASH_SECRET: 'test-only-secret-of-at-least-32-characters', OTP_DELIVERY_MODE: 'file', PAYMENT_WEBHOOK_SECRET: 'test-only-webhook-secret-of-at-least-32-characters' };
  assert.equal(validateEnvironment(valid).PORT, 3001);
  assert.throws(() => validateEnvironment({ ...valid, DATABASE_URL: '' }));
  assert.throws(() => validateEnvironment({ ...valid, PORT: 'not-a-port' }));
  assert.throws(() => validateEnvironment({ ...valid, NODE_ENV: 'production' }));
  assert.throws(() => validateEnvironment({ ...valid, CORS_ORIGINS: '*' }));
  assert.throws(() => validateEnvironment({ ...valid, PAYMENT_WEBHOOK_SECRET: '' }), /PAYMENT_WEBHOOK_SECRET/);
  assert.throws(() => validateEnvironment({ ...valid, APP_ENVIRONMENT: 'staging' }), /inconsistent/);
  assert.throws(() => validateEnvironment({ ...valid, DISPATCH_WORKER_ENABLED: 'maybe' }), /DISPATCH_WORKER_ENABLED/);
  const staging = { ...valid, NODE_ENV: 'production', APP_ENVIRONMENT: 'staging', HOST: '0.0.0.0', PORT: '3001',
    DATABASE_URL: 'postgresql://example:placeholder@db.example.test/app?sslmode=require&sslaccept=strict',
    REDIS_URL: 'rediss://:placeholder@redis.example.test:6380', CORS_ORIGINS: 'https://admin.example.test',
    OTP_DELIVERY_MODE: 'twilio', TWILIO_ACCOUNT_SID: `AC${'a'.repeat(32)}`, TWILIO_AUTH_TOKEN: 'dummy-token', TWILIO_FROM: '+962000000000', PAYMENT_PROVIDER: 'mock' };
  assert.equal(validateEnvironment(staging).HOST, '0.0.0.0');
  assert.throws(() => validateEnvironment({ ...staging, OTP_DELIVERY_MODE: 'file' }), /local-only/);
  assert.throws(() => validateEnvironment({ ...staging, CORS_ORIGINS: 'http://admin.example.test' }), /CORS_ORIGINS/);
  assert.throws(() => validateEnvironment({ ...staging, DATABASE_URL: valid.DATABASE_URL }), /DATABASE_URL/);
  assert.throws(() => validateEnvironment({ ...staging, DATABASE_URL: staging.DATABASE_URL.replace('sslaccept=strict', 'sslaccept=accept_invalid_certs') }), /DATABASE_URL/);
  assert.throws(() => validateEnvironment({ ...staging, REDIS_URL: valid.REDIS_URL }), /REDIS_URL/);
  assert.throws(() => validateEnvironment({ ...staging, APP_ENVIRONMENT: 'production' }), /not implemented/);
});

test('provider scopes never include another company or implicit admin access', () => {
  const companyId = randomUUID();
  const teamId = randomUUID();
  const actor = { userId: randomUUID(), sessionId: randomUUID(), familyId: randomUUID(), scopes: [{ role: 'TEAM_LEADER_CLEANER', companyId, teamId, permissions: ['assignment:team'] }] };
  assert.deepEqual(assignmentScope(actor), { OR: [{ companyId, teamId }] });
  assert.throws(() => companyScope(actor, randomUUID(), 'assignment:team'));
  assert.throws(() => assignmentScope({ ...actor, scopes: [] }));
});

test('platform permissions require one unscoped Home Clean Admin grant', () => {
  const actor = (scopes) => ({ userId: randomUUID(), sessionId: randomUUID(), familyId: randomUUID(), scopes });
  const permission = 'admin:dashboard:read';
  assert.equal(hasPlatformPermission(actor([{ role: 'HOME_CLEAN_ADMIN', companyId: null, teamId: null, permissions: [permission] }]), permission), true);
  assert.equal(hasPlatformPermission(actor([{ role: 'DISPATCHER', companyId: null, teamId: null, permissions: [permission] }]), permission), false);
  assert.equal(hasPlatformPermission(actor([{ role: 'HOME_CLEAN_ADMIN', companyId: randomUUID(), teamId: null, permissions: [permission] }]), permission), false);
  assert.equal(hasPlatformPermission(actor([
    { role: 'HOME_CLEAN_ADMIN', companyId: null, teamId: null, permissions: [] },
    { role: 'DISPATCHER', companyId: null, teamId: null, permissions: [permission] },
  ]), permission), false);
});

test('live Admin guard fails closed for revoked, scoped and non-Admin grants', async () => {
  const token = 'a'.repeat(43);
  const user = { status: 'ACTIVE', roles: [] };
  const current = { id: randomUUID(), userId: randomUUID(), familyId: randomUUID(), revokedAt: null,
    accessExpiresAt: new Date(Date.now() + 60000), expiresAt: new Date(Date.now() + 60000), user };
  const guard = new AuthGuard(new Reflector(), { session: { findUnique: async ({ where }) => {
    assert.equal(where.accessTokenHash, sessionHash(token));
    return current;
  } } });
  const request = { header: () => `Bearer ${token}` };
  const context = { getHandler: () => AdminServicesController.prototype.list, getClass: () => AdminServicesController,
    switchToHttp: () => ({ getRequest: () => request }) };
  const grant = (name, companyId, permissions) => ({ companyId, teamId: null, role: { name,
    permissions: permissions.map(code => ({ permission: { code } })) }, company: companyId ? { status: 'ACTIVE' } : null });

  user.roles = [grant('CUSTOMER', null, ['service:manage'])];
  await assert.rejects(guard.canActivate(context), error => error.getStatus?.() === 403);
  user.roles = [grant('DISPATCHER', null, ['service:manage'])];
  await assert.rejects(guard.canActivate(context), error => error.getStatus?.() === 403);
  user.roles = [grant('HOME_CLEAN_ADMIN', randomUUID(), ['service:manage'])];
  await assert.rejects(guard.canActivate(context), error => error.getStatus?.() === 403);
  user.roles = [grant('HOME_CLEAN_ADMIN', null, ['service:manage'])];
  assert.equal(await guard.canActivate(context), true);
  current.revokedAt = new Date();
  await assert.rejects(guard.canActivate(context), error => error.getStatus?.() === 401);
});
