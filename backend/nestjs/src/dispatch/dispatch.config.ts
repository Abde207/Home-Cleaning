import type { DispatchConfig, DispatchWeights } from './dispatch.policy.js';

const defaults: DispatchWeights = {
  availability: 1, service: 1, capability: 1, proximity: 3,
  workload: 2, reliability: 1, performance: 1,
};

function positiveInteger(value: string | undefined, fallback: number, name: string, max: number) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) throw new Error(`${name} must be an integer between 1 and ${max}`);
  return parsed;
}

export function dispatchConfig(env: NodeJS.ProcessEnv = process.env): DispatchConfig {
  let supplied: Record<string, unknown> = {};
  if (env.DISPATCH_WEIGHTS_JSON) {
    try { supplied = JSON.parse(env.DISPATCH_WEIGHTS_JSON) as Record<string, unknown>; }
    catch { throw new Error('DISPATCH_WEIGHTS_JSON must be valid JSON'); }
    if (!supplied || Array.isArray(supplied) || typeof supplied !== 'object' ||
      Object.keys(supplied).some(key => !(key in defaults))) throw new Error('DISPATCH_WEIGHTS_JSON has unknown or invalid keys');
  }
  const weights = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof DispatchWeights)[]) {
    if (supplied[key] !== undefined) {
      const value = supplied[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) throw new Error(`Invalid dispatch weight: ${key}`);
      weights[key] = value;
    }
  }
  if (Object.values(weights).every(weight => weight === 0)) throw new Error('At least one dispatch weight must be positive');
  return {
    weights,
    offerSeconds: positiveInteger(env.DISPATCH_OFFER_SECONDS, 600, 'DISPATCH_OFFER_SECONDS', 3600),
    maxAttempts: positiveInteger(env.DISPATCH_MAX_ATTEMPTS, 3, 'DISPATCH_MAX_ATTEMPTS', 20),
    travelKph: positiveInteger(env.DISPATCH_TRAVEL_KPH, 30, 'DISPATCH_TRAVEL_KPH', 120),
    locationMaxAgeMinutes: positiveInteger(env.DISPATCH_LOCATION_MAX_AGE_MINUTES, 120, 'DISPATCH_LOCATION_MAX_AGE_MINUTES', 1440),
  };
}
