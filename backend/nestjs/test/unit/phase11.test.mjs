import test from 'node:test';
import assert from 'node:assert/strict';
import { DeterministicGeocodingProvider } from '../../dist/location/location.provider.js';
import { InvalidPushTokenError, MockPushNotificationProvider } from '../../dist/notifications/notification.provider.js';
import { evaluateCandidate } from '../../dist/dispatch/dispatch.policy.js';

test('deterministic geocoder is credential-free and stable for automated tests', async () => {
  const provider = new DeterministicGeocodingProvider();
  const first = await provider.geocode('Amman, Jordan');
  const second = await provider.geocode('Amman, Jordan');
  assert.deepEqual(first, second);
  assert.ok(first.latitude >= 31.65 && first.latitude <= 32.30);
  assert.ok(first.longitude >= 35.65 && first.longitude <= 36.50);
  assert.equal((await provider.reverseGeocode(first.latitude, first.longitude)).formattedAddress, `${first.latitude.toFixed(7)}, ${first.longitude.toFixed(7)}`);
});

test('mock push provider distinguishes invalid tokens from successful delivery', async () => {
  const provider = new MockPushNotificationProvider();
  assert.match((await provider.send({ token: 'valid-token-1234567890', title: 't', body: 'b', data: {} })).providerReference, /^mock-push-/);
  await assert.rejects(provider.send({ token: 'invalid-token-1234567890', title: 't', body: 'b', data: {} }), error => error instanceof InvalidPushTokenError);
});

test('dispatch keeps service-area eligibility and uses area fallback for stale team location', () => {
  const now = new Date('2026-09-21T00:00:00Z');
  const decision = evaluateCandidate({
    id: 'team-1', companyId: 'company-1', active: true, companyActive: true, status: 'AVAILABLE', capacity: 1, serviceMatch: true,
    availability: [{ startsAt: new Date('2027-01-01T00:00:00Z'), endsAt: new Date('2027-01-01T02:00:00Z'), available: true }],
    areas: [{ latitude: 31.95, longitude: 35.91, radiusKm: 5, active: true }],
    latitude: 31.96, longitude: 35.92, locationAt: new Date('2026-01-01T00:00:00Z'), activeWorkload: 0, offers: 0, accepted: 0, completed: 0,
  }, { startsAt: new Date('2027-01-01T00:00:00Z'), endsAt: new Date('2027-01-01T01:00:00Z'), latitude: 31.95, longitude: 35.91, serviceId: 'service-1' }, {
    weights: { availability: 1, service: 1, capability: 1, proximity: 3, workload: 2, reliability: 1, performance: 1 }, offerSeconds: 600, maxAttempts: 3, travelKph: 30, locationMaxAgeMinutes: 120,
  }, now);
  assert.equal(decision.eligible, true);
  assert.equal(decision.locationSource, 'area');
});
