import { createHash } from 'node:crypto';

export type GeoPoint = { latitude: number; longitude: number; formattedAddress?: string };

export interface GeocodingProvider {
  readonly name: string;
  geocode(addressText: string): Promise<GeoPoint>;
  reverseGeocode(latitude: number, longitude: number): Promise<GeoPoint>;
}

export interface RoutingProvider {
  readonly name: string;
  etaSeconds(from: GeoPoint, to: GeoPoint): Promise<number | null>;
}

export const GEOCODING_PROVIDER = 'GEOCODING_PROVIDER';
export const ROUTING_PROVIDER = 'ROUTING_PROVIDER';

/** Local tests can explicitly model an unavailable road route. */
export class UnavailableRoutingProvider implements RoutingProvider {
  readonly name = 'unavailable-local';
  async etaSeconds(_from: GeoPoint, _to: GeoPoint) { return null; }
}

/** Deterministic local provider: tests and local development need no map credentials. */
export class DeterministicGeocodingProvider implements GeocodingProvider {
  readonly name = 'deterministic-local';
  async geocode(addressText: string) {
    const digest = createHash('sha256').update(addressText.trim().toLowerCase()).digest();
    const latitude = 31.65 + (digest.readUInt16BE(0) / 65535) * 0.65;
    const longitude = 35.65 + (digest.readUInt16BE(2) / 65535) * 0.85;
    return { latitude: Number(latitude.toFixed(7)), longitude: Number(longitude.toFixed(7)), formattedAddress: addressText.trim() };
  }
  async reverseGeocode(latitude: number, longitude: number) {
    return { latitude, longitude, formattedAddress: `${latitude.toFixed(7)}, ${longitude.toFixed(7)}` };
  }
}
