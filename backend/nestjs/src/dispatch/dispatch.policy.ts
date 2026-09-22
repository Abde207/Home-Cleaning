export type DispatchWeights = {
  availability: number; service: number; capability: number; proximity: number;
  workload: number; reliability: number; performance: number;
};

export type DispatchConfig = {
  weights: DispatchWeights;
  offerSeconds: number;
  maxAttempts: number;
  travelKph: number;
  locationMaxAgeMinutes: number;
};

export type DispatchCandidate = {
  id: string; companyId: string; active: boolean; companyActive: boolean;
  status: string; capacity: number; serviceMatch: boolean;
  availability: { startsAt: Date; endsAt: Date; available: boolean }[];
  areas: { latitude: number; longitude: number; radiusKm: number; active: boolean }[];
  latitude: number | null; longitude: number | null; locationAt: Date | null;
  activeWorkload: number; offers: number; accepted: number; completed: number;
};

export type DispatchSlot = { startsAt: Date; endsAt: Date; latitude: number; longitude: number; serviceId: string };

export type CandidateDecision = {
  teamId: string; companyId: string; eligible: boolean; reasons: string[];
  score: number | null; distanceKm: number | null; etaMinutes: number | null;
  factors: Record<keyof DispatchWeights, number> | null;
  locationSource: 'team' | 'area' | null;
};

const earthKm = 6371.0088;
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function evaluateCandidate(team: DispatchCandidate, slot: DispatchSlot, config: DispatchConfig, now: Date): CandidateDecision {
  const reasons: string[] = [];
  if (!team.active || !team.companyActive || team.status !== 'AVAILABLE') reasons.push('NOT_OPERATIONAL');
  if (!team.serviceMatch) reasons.push('SERVICE_MISMATCH');
  if (!Number.isInteger(team.capacity) || team.capacity < 1 || team.activeWorkload >= team.capacity) reasons.push('CAPACITY_EXHAUSTED');
  if (!team.availability.some(row => row.available && row.startsAt <= slot.startsAt && row.endsAt >= slot.endsAt) ||
      team.availability.some(row => !row.available && row.startsAt < slot.endsAt && row.endsAt > slot.startsAt)) reasons.push('NOT_AVAILABLE');
  const covered = team.areas.filter(area => area.active && area.radiusKm > 0 &&
    distanceKm(area.latitude, area.longitude, slot.latitude, slot.longitude) <= area.radiusKm);
  if (!covered.length) reasons.push('OUTSIDE_SERVICE_AREA');
  const freshLocation = team.latitude !== null && team.longitude !== null && team.locationAt !== null &&
    now.getTime() - team.locationAt.getTime() <= config.locationMaxAgeMinutes * 60_000 && team.locationAt <= now;
  const source = freshLocation ? 'team' : covered.length ? 'area' : null;
  const distance = freshLocation ? distanceKm(team.latitude!, team.longitude!, slot.latitude, slot.longitude) :
    covered.length ? Math.min(...covered.map(area => distanceKm(area.latitude, area.longitude, slot.latitude, slot.longitude))) : null;
  const eta = distance === null ? null : distance / config.travelKph * 60;
  if (eta === null) reasons.push('ETA_UNAVAILABLE');
  const eligible = reasons.length === 0;
  const factors: CandidateDecision['factors'] = eligible ? {
    availability: 1, service: 1, capability: 1,
    proximity: 1 / (1 + eta! / 30),
    workload: 1 - team.activeWorkload / team.capacity,
    reliability: (team.accepted + 1) / (team.offers + 2),
    performance: (team.completed + 1) / (team.accepted + 2),
  } : null;
  const score = factors ? Math.round((Object.keys(config.weights) as (keyof DispatchWeights)[])
    .reduce((sum, key) => sum + factors[key] * config.weights[key], 0) * 1_000_000) / 1_000_000 : null;
  return { teamId: team.id, companyId: team.companyId, eligible, reasons, score,
    distanceKm: distance === null ? null : Math.round(distance * 1000) / 1000,
    etaMinutes: eta === null ? null : Math.round(eta * 10) / 10, factors, locationSource: source };
}

export function rankCandidates(decisions: CandidateDecision[]) {
  return decisions.filter(row => row.eligible).sort((a, b) =>
    b.score! - a.score! || a.etaMinutes! - b.etaMinutes! || a.teamId.localeCompare(b.teamId));
}
