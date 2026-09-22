import test from 'node:test';
import assert from 'node:assert/strict';
import { queryString } from '../lib/query.ts';
import { messagesFor } from '../messages/index.ts';
import { visibleNavigation, type Identity } from '../lib/permissions.ts';

const admin = (permissions: string[]): Identity => ({ id: 'admin', name: 'Admin', phone: '+962790000000', locale: 'en', scopes: [{ role: 'HOME_CLEAN_ADMIN', companyId: null, teamId: null, permissions }] });

test('Phase 14G navigation is permission-aware for notifications and locations', () => {
  const paths = visibleNavigation(admin(['notification:operations:read', 'admin:dashboard:read'])).flatMap(group => group.items.map(item => item.path));
  assert.equal(paths.includes('/communications/notifications'), true);
  assert.equal(paths.includes('/operations/locations'), true);
});

test('Phase 14G filters use fixed bounded query construction', () => {
  assert.equal(queryString({ status: 'FAILED', type: 'BOOKING_CREATED', freshness: 'STALE', userId: 'recipient' }), '?status=FAILED&type=BOOKING_CREATED&freshness=STALE&userId=recipient');
});

test('Phase 14G translations cover operational privacy and freshness states', () => {
  const en = messagesFor('en');
  const ar = messagesFor('ar');
  for (const key of ['notificationsTitle', 'notificationPrivacy', 'deliveryHistory', 'locationsTitle', 'freshness', 'neverReported', 'locationPrivacy'] as const) {
    assert.ok(en[key]);
    assert.ok(ar[key]);
  }
});
