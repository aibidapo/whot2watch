// Import via TS shim to satisfy typechecker while using CJS implementation
import { canonicalizeProvider } from './provider-alias';

export interface RawTitle {
  name: string;
  type: 'MOVIE' | 'SHOW';
  releaseYear?: number;
  runtimeMin?: number;
  genres?: string[];
  moods?: string[];
  providers?: string[];
}

export interface NormalizedTitle {
  name: string;
  type: 'MOVIE' | 'SHOW';
  releaseYear?: number | undefined;
  runtimeMin?: number | undefined;
  genres: string[];
  moods: string[];
  availability: { service: string; region: string; offerType: string }[];
}

export function normalizeTitle(raw: RawTitle, region: string): NormalizedTitle {
  const services = (raw.providers || [])
    .map((p) => canonicalizeProvider(p))
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  return {
    name: raw.name,
    type: raw.type,
    releaseYear: raw.releaseYear,
    runtimeMin: raw.runtimeMin,
    genres: raw.genres || [],
    moods: raw.moods || [],
    availability: services.map((s) => ({ service: s, region, offerType: 'SUBSCRIPTION' })),
  };
}
