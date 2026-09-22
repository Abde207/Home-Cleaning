import test from 'node:test';
import assert from 'node:assert/strict';
import { messagesFor } from '../messages/index.ts';
import { platformPermissions, visibleNavigation, type Identity } from '../lib/permissions.ts';

const admin = (permissions: string[]): Identity => ({ id: 'admin', name: 'Admin', phone: '+962790000000', locale: 'en', scopes: [{ role: 'HOME_CLEAN_ADMIN', companyId: null, teamId: null, permissions }] });

test('Phase 14D navigation exposes provider and catalog workspaces only to granted Admins', () => {
  const identity = admin(['company:manage', 'team:manage', 'service:manage', 'pricing:manage', 'promotion:manage']);
  const paths = visibleNavigation(identity).flatMap(group => group.items.map(item => item.path));
  assert.deepEqual(paths, ['/providers/companies', '/providers/teams', '/catalog/services', '/catalog/pricing', '/catalog/promotions']);
  assert.equal(platformPermissions(identity).has('team:manage'), true);
  assert.deepEqual(visibleNavigation({ ...identity, scopes: [{ ...identity.scopes[0], companyId: 'scoped-company' }] }), []);
});

test('Phase 14D translations cover provider, team, catalog and pricing controls', () => {
  const en = messagesFor('en'); const ar = messagesFor('ar');
  for (const key of ['companiesTitle', 'operationalCounts', 'teamsTitle', 'capabilities', 'servicesTitle', 'extras', 'pricingTitle', 'publishRule', 'publishPromotion', 'activate'] as const) {
    assert.ok(en[key]); assert.ok(ar[key]);
  }
  assert.notEqual(en.companiesTitle, ar.companiesTitle);
});
