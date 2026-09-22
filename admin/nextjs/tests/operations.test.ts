import test from 'node:test';
import assert from 'node:assert/strict';
import { messagesFor } from '../messages/index.ts';
import { platformPermissions, visibleNavigation, type Identity } from '../lib/permissions.ts';

const admin = (permissions: string[]): Identity => ({ id: 'admin', name: 'Admin', phone: '+962790000000', locale: 'en', scopes: [{ role: 'HOME_CLEAN_ADMIN', companyId: null, teamId: null, permissions }] });

test('Phase 14E exposes dispatch navigation only through the existing dispatch permission', () => {
  const identity = admin(['dispatch:manage']);
  assert.equal(platformPermissions(identity).has('dispatch:manage'), true);
  assert.deepEqual(visibleNavigation(identity).flatMap(group => group.items.map(item => item.path)), ['/operations/dispatch']);
});

test('Phase 14E command and investigation translations exist in both directions', () => {
  const en = messagesFor('en');
  const ar = messagesFor('ar');
  for (const key of ['phase14e', 'dispatchTitle', 'automaticOffer', 'manualDispatch', 'overrideWarning', 'retryAssignment', 'unsupportedReassignment', 'paymentState'] as const) {
    assert.ok(en[key]);
    assert.ok(ar[key]);
  }
});
