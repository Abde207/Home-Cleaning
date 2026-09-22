import test from 'node:test';
import assert from 'node:assert/strict';
import { TrackingService, distanceMeters } from '../../dist/location/tracking.service.js';

const actor = { userId: 'user', scopes: [] };
const start = new Date(Date.now() - 600_000);
const current = (team, status = 'TEAM_ON_THE_WAY') => ({ status, history: [{ createdAt: start }],
  assignments: [{ id: 'new-assignment', team }] });
function service(booking) {
  return new TrackingService({ customer: { findUnique: async () => ({ id: 'customer' }) },
    booking: { findFirst: async () => booking } }, { get: () => 120 });
}

test('tracking does not reveal coordinates before the team is on the way', async () => {
  const result = await service(current({ latitude: 31, longitude: 35, locationAt: new Date() }, 'TEAM_ACCEPTED')).current(actor, 'booking');
  assert.deepEqual(result, { active: false, location: null, etaSeconds: null });
});
test('tracking returns only the assigned team and marks stale location', async () => {
  const old = new Date(Date.now() - 180_000);
  const result = await service(current({ latitude: 31, longitude: 35, locationAt: old })).current(actor, 'booking');
  assert.equal(result.location.stale, true);
  assert.equal(result.location.latitude, 31);
  const reassigned = await service(current({ latitude: 32, longitude: 36, locationAt: new Date() })).current(actor, 'booking');
  assert.equal(reassigned.location.latitude, 32);
});
test('pre-start location stays private and geofence distance is bounded', async () => {
  const result = await service(current({ latitude: 31, longitude: 35, locationAt: new Date(start.getTime() - 1) })).current(actor, 'booking');
  assert.equal(result.location, null);
  assert.equal(distanceMeters({ latitude: 31, longitude: 35 }, { latitude: 31, longitude: 35 }), 0);
  assert.ok(distanceMeters({ latitude: 31, longitude: 35 }, { latitude: 32, longitude: 35 }) > 100_000);
});
