import { canonicalizeProvider } from './providerAlias';

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
  releaseYear?: number;
  runtimeMin?: number;
  genres: string[];
  moods: string[];
  availability: { service: string; region: string; offerType: string }[];
}

export function normalizeTitle(raw: RawTitle, region: string): NormalizedTitle {
  const services = (raw.providers || []).map(canonicalizeProvider).filter(Boolean);
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
