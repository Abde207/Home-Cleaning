import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchConfig } from '../../dist/dispatch/dispatch.config.js';
import { distanceKm, evaluateCandidate, rankCandidates } from '../../dist/dispatch/dispatch.policy.js';
import { DispatchService } from '../../dist/dispatch/dispatch.service.js';

const config = dispatchConfig({});
const start = new Date('2027-03-01T10:00:00Z');
const end = new Date('2027-03-01T11:00:00Z');
const slot = { startsAt: start, endsAt: end, latitude: 31.95, longitude: 35.91, serviceId: 'service' };
const candidate = {
  id: 'a', companyId: 'company', active: true, companyActive: true, status: 'AVAILABLE', capacity: 2,
  serviceMatch: true, availability: [{ startsAt: new Date('2027-03-01T09:00:00Z'), endsAt: new Date('2027-03-01T12:00:00Z'), available: true }],
  areas: [{ latitude: 31.95, longitude: 35.91, radiusKm: 10, active: true }],
  latitude: 31.95, longitude: 35.91, locationAt: new Date('2027-03-01T09:45:00Z'),
  activeWorkload: 0, offers: 4, accepted: 3, completed: 2,
};
const now = new Date('2027-03-01T09:50:00Z');

test('dispatch policy selects deterministic eligible candidates and records factor scores', () => {
  const best = evaluateCandidate(candidate, slot, config, now);
  const farther = evaluateCandidate({ ...candidate, id: 'b', latitude: 31.96, longitude: 35.92 }, slot, config, now);
  assert.equal(best.eligible, true);
  assert.ok(best.score > farther.score);
  assert.equal(best.etaMinutes, 0);
  assert.equal(best.locationSource, 'team');
  assert.deepEqual(rankCandidates([farther, best]).map(row => row.teamId), ['a', 'b']);
  assert.deepEqual(rankCandidates([{ ...best, teamId: 'b' }, best]).map(row => row.teamId), ['a', 'b']);
  assert.equal(distanceKm(31.95, 35.91, 31.95, 35.91), 0);
});

test('dispatch eligibility rejects unavailable, uncovered, unskilled and over-capacity teams', () => {
  assert.deepEqual(evaluateCandidate({ ...candidate, availability: [] }, slot, config, now).reasons, ['NOT_AVAILABLE']);
  assert.deepEqual(evaluateCandidate({ ...candidate, areas: [] }, slot, config, now).reasons, ['OUTSIDE_SERVICE_AREA']);
  assert.deepEqual(evaluateCandidate({ ...candidate, serviceMatch: false, activeWorkload: 2 }, slot, config, now).reasons, ['SERVICE_MISMATCH', 'CAPACITY_EXHAUSTED']);
  assert.deepEqual(evaluateCandidate({ ...candidate, status: 'OFFLINE' }, slot, config, now).reasons, ['NOT_OPERATIONAL']);
  assert.deepEqual(evaluateCandidate({ ...candidate, availability: [...candidate.availability, { startsAt: start, endsAt: end, available: false }] }, slot, config, now).reasons, ['NOT_AVAILABLE']);
});

test('dispatch configuration validates configurable weights and retry/offer limits', () => {
  const changed = dispatchConfig({ DISPATCH_WEIGHTS_JSON: '{"proximity":7}', DISPATCH_MAX_ATTEMPTS: '5', DISPATCH_OFFER_SECONDS: '30' });
  assert.equal(changed.weights.proximity, 7);
  assert.equal(changed.maxAttempts, 5);
  assert.equal(changed.offerSeconds, 30);
  assert.throws(() => dispatchConfig({ DISPATCH_WEIGHTS_JSON: '{"unknown":1}' }));
  assert.throws(() => dispatchConfig({ DISPATCH_MAX_ATTEMPTS: '0' }));
  assert.throws(() => dispatchConfig({ DISPATCH_WEIGHTS_JSON: '{"proximity":-1}' }));
});

test('manual dispatch rejects a provider-scoped grant even if permission is misconfigured', async () => {
  const dispatch = new DispatchService({}, {});
  const actor = { userId: 'provider', scopes: [{ role: 'COMPANY_MANAGER', companyId: 'company', teamId: null, permissions: ['dispatch:manage'] }] };
  await assert.rejects(dispatch.manual(actor, 'booking', { companyId: 'company', teamId: 'team', reason: 'Attempted scoped dispatch' }, 'key'),
    error => error.getStatus?.() === 403);
});
