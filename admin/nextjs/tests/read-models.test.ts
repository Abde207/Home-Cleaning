import test from 'node:test';
import assert from 'node:assert/strict';
import { queryString } from '../lib/query.ts';
import { platformPermissions, visibleNavigation, type Identity } from '../lib/permissions.ts';
import { messagesFor } from '../messages/index.ts';

const admin = (permissions: string[]): Identity => ({ id: 'admin', name: 'Admin', phone: '+962790000000', locale: 'en', scopes: [{ role: 'HOME_CLEAN_ADMIN', companyId: null, teamId: null, permissions }] });

test('Phase 14B Admin query construction is bounded to fixed server paths', () => {
  assert.equal(queryString({ status: 'PAYMENT_CONFIRMED', bookingNumber: 'B14', empty: undefined }), '?status=PAYMENT_CONFIRMED&bookingNumber=B14');
  assert.equal(queryString({}), '');
});

test('Admin navigation exposes Phase 14B read models and the Phase 14C customer workspace', () => {
  const identity = admin(['admin:dashboard:read', 'booking:operations', 'customer:read', 'identity:read', 'audit:read']);
  assert.equal(platformPermissions(identity).has('identity:read'), true);
  const paths = visibleNavigation(identity).flatMap(group => group.items.map(item => item.path));
  assert.deepEqual(paths, ['', '/operations/bookings', '/operations/locations', '/customers', '/governance/users', '/governance/audit']);
});

test('Phase 14B and 14C translations cover the read-model UI in both directions', () => {
  const en = messagesFor('en');
  const ar = messagesFor('ar');
  for (const key of ['dashboardTitle', 'bookingsTitle', 'usersTitle', 'auditTitle', 'redactedPayload', 'customersTitle', 'customerDetailTitle', 'provisionTitle', 'revokeWarning'] as const) {
    assert.ok(en[key]);
    assert.ok(ar[key]);
  }
});
