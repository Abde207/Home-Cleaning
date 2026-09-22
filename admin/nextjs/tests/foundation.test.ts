import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApiError, backendRequest, backendUrl } from '../lib/api.ts';
import { adminEnvironment } from '../lib/environment.ts';
import { isLocale, localeDirection } from '../lib/i18n.ts';
import { isPlatformAdmin, platformPermissions, visibleNavigation, type Identity } from '../lib/permissions.ts';
import { createRefreshCoalescer } from '../lib/refresh-coalescer.ts';
import { messagesFor } from '../messages/index.ts';

const identity = (scopes: Identity['scopes']): Identity => ({ id: 'admin-id', name: 'Test Admin', phone: '+962790000000', locale: 'ar', scopes });
const admin = identity([{ role: 'HOME_CLEAN_ADMIN', companyId: null, teamId: null, permissions: ['admin:dashboard:read', 'customer:read'] }]);

test('locale and translation dictionaries are complete and support RTL/LTR', () => {
  assert.equal(isLocale('en'), true);
  assert.equal(isLocale('ar'), true);
  assert.equal(isLocale('fr'), false);
  assert.equal(localeDirection('en'), 'ltr');
  assert.equal(localeDirection('ar'), 'rtl');
  const en = messagesFor('en'), ar = messagesFor('ar');
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ar).sort());
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    assert.ok(en[key].trim(), `English ${key}`);
    assert.ok(ar[key].trim(), `Arabic ${key}`);
  }
  assert.match(renderToStaticMarkup(createElement('main', { lang: 'ar', dir: localeDirection('ar') }, createElement('h1', null, ar.signInTitle))), /dir="rtl"/);
});

test('navigation requires permissions on one unscoped platform Admin grant', () => {
  assert.equal(isPlatformAdmin(admin), true);
  assert.equal(platformPermissions(admin).has('customer:read'), true);
  assert.deepEqual(visibleNavigation(admin).map(group => group.label), ['groupOverview', 'groupOperations', 'groupCustomers']);
  for (const scopes of [
    [{ role: 'CUSTOMER', companyId: null, teamId: null, permissions: ['admin:dashboard:read'] }],
    [{ role: 'DISPATCHER', companyId: null, teamId: null, permissions: ['admin:dashboard:read'] }],
    [{ role: 'HOME_CLEAN_ADMIN', companyId: 'foreign', teamId: null, permissions: ['admin:dashboard:read'] }],
  ]) {
    const actor = identity(scopes);
    assert.equal(isPlatformAdmin(actor), false);
    assert.deepEqual(visibleNavigation(actor), []);
  }
  assert.deepEqual(visibleNavigation(identity([
    { role: 'HOME_CLEAN_ADMIN', companyId: null, teamId: null, permissions: [] },
    { role: 'DISPATCHER', companyId: null, teamId: null, permissions: ['admin:dashboard:read'] },
  ])), []);
});

test('backend transport keeps bearer server-side and preserves sanitized errors/request IDs', async () => {
  const previousUrl = process.env.BACKEND_API_URL;
  const previousFetch = globalThis.fetch;
  process.env.BACKEND_API_URL = 'http://127.0.0.1:3001/api/v1';
  try {
    assert.equal(backendUrl(), 'http://127.0.0.1:3001/api/v1');
    globalThis.fetch = async (_input, init) => {
      assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer private-token');
      assert.equal(init?.cache, 'no-store');
      return new Response(JSON.stringify({ success: true, data: { id: 'safe' }, meta: { requestId: 'test-id' } }), { status: 200 });
    };
    assert.deepEqual(await backendRequest('/auth/me', { accessToken: 'private-token' }), { id: 'safe' });
    globalThis.fetch = async () => new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN_RESOURCE', message: 'Denied' }, meta: { requestId: 'denied-id' } }), { status: 403 });
    await assert.rejects(backendRequest('/auth/me'), error => error instanceof ApiError && error.status === 403 && error.code === 'FORBIDDEN_RESOURCE' && error.requestId === 'denied-id');
    await assert.rejects(backendRequest('//attacker.example'), /fixed backend API path/);
    process.env.BACKEND_API_URL = 'https://example.com/api/v1?token=bad';
    assert.throws(backendUrl, /without credentials or query/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.BACKEND_API_URL;
    else process.env.BACKEND_API_URL = previousUrl;
  }
});

test('Admin environment validates staging and rejects unsafe URLs', () => {
  const base = { NODE_ENV: 'production', APP_ENVIRONMENT: 'staging', BACKEND_API_URL: 'https://backend.example.test/api/v1' } as const;
  assert.equal(adminEnvironment(base).backendApiUrl, base.BACKEND_API_URL);
  assert.throws(() => adminEnvironment({ ...base, BACKEND_API_URL: 'http://backend.example.test/api/v1' }), /HTTPS/);
  assert.throws(() => adminEnvironment({ ...base, BACKEND_API_URL: 'https://user:pass@backend.example.test/api/v1' }), /without credentials/);
  assert.throws(() => adminEnvironment({ ...base, APP_ENVIRONMENT: 'development' }), /inconsistent/);
  assert.throws(() => adminEnvironment({ ...base, BACKEND_API_URL: '' }), /required/);
});

test('same-process refresh coalesces concurrent requests for one old token', async () => {
  const coalesce = createRefreshCoalescer<string>();
  let rotations = 0;
  const rotate = async () => { rotations++; return 'new-token'; };
  const results = await Promise.all(Array.from({ length: 5 }, () => coalesce('old-token', rotate)));
  assert.deepEqual(results, Array(5).fill('new-token'));
  assert.equal(rotations, 1);
  assert.equal(await coalesce('old-token', rotate), 'new-token');
  assert.equal(rotations, 1);
  assert.equal(await coalesce('another-token', rotate), 'new-token');
  assert.equal(rotations, 2);
});
