import { describe, it, expect } from 'vitest';
import { normalizeDeepLink, slugifyTitle } from './deeplink';

describe('deeplink', () => {
  it('slugifies title', () => {
    expect(slugifyTitle('The Matrix: Reloaded!')).toBe('the-matrix-reloaded');
  });

  it('uses provider base when known', () => {
    const url = normalizeDeepLink({ service: 'NETFLIX', titleName: 'Sample' });
    expect(url!.includes('netflix')).toBe(true);
  });

  it('falls back to TMDB when provider unknown', () => {
    const url = normalizeDeepLink({ service: 'OTHER', titleName: 'X', tmdbId: 123, type: 'MOVIE' });
    expect(url).toBe('https://www.themoviedb.org/movie/123');
  });

  it('falls back to TMDB for SHOW type', () => {
    const url = normalizeDeepLink({ service: 'OTHER', titleName: 'X', tmdbId: 456, type: 'SHOW' });
    expect(url).toBe('https://www.themoviedb.org/tv/456');
  });

  it('returns undefined when no provider and no tmdbId', () => {
    const url = normalizeDeepLink({ service: 'OTHER', titleName: 'X' });
    expect(url).toBeUndefined();
  });

  it('returns base URL for other known providers', () => {
    for (const svc of [
      'DISNEY_PLUS',
      'HULU',
      'MAX',
      'AMAZON_PRIME_VIDEO',
      'APPLE_TV_PLUS',
      'PARAMOUNT_PLUS',
      'PEACOCK',
    ]) {
      const u = normalizeDeepLink({ service: svc, titleName: 'Anything' });
      expect(typeof u).toBe('string');
      expect((u as string).startsWith('http')).toBe(true);
    }
  });
});
