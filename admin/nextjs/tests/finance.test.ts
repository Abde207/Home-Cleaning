import test from 'node:test';
import assert from 'node:assert/strict';
import { messagesFor } from '../messages/index.ts';
import { navigation, visibleNavigation, platformPermissions, type Identity } from '../lib/permissions.ts';

test('Phase 14F finance navigation and bilingual finance copy are present', () => {
  const permissions = new Set(['payment:read', 'cash:read', 'settlement:read']);
  const identity: Identity = { id: 'admin', name: 'Admin', phone: '+10000000000', locale: 'en', scopes: [{ role: 'HOME_CLEAN_ADMIN', companyId: null, teamId: null, permissions: [...permissions] }] };
  const paths = visibleNavigation(identity).flatMap(group => group.items.map(item => item.path));
  assert.deepEqual(paths.filter(path => path.startsWith('/finance/')), ['/finance/payments', '/finance/cash', '/finance/settlements']);
  assert.equal(platformPermissions(identity).has('payment:read'), true);
  const en = messagesFor('en'); const ar = messagesFor('ar');
  for (const key of ['phase14f', 'paymentsTitle', 'cashTitle', 'settlementsTitle', 'financeCommandWarning'] as const) { assert.ok(en[key]); assert.ok(ar[key]); }
  assert.equal(navigation.some(group => group.label === 'groupFinance'), true);
});
