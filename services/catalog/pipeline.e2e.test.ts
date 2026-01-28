import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { toIndexedDoc } = require('./indexFromDb');

describe('toIndexedDoc (pipeline E2E)', () => {
  const fullTitle = {
    id: 'title-1',
    name: 'Test Movie',
    type: 'MOVIE',
    releaseYear: 2024,
    runtimeMin: 120,
    genres: ['Action', 'Comedy'],
    moods: ['Fun'],
    posterUrl: 'https://img.example.com/poster.jpg',
    backdropUrl: 'https://img.example.com/backdrop.jpg',
    voteAverage: 7.5,
    popularity: 85.3,
    externalRatings: [
      { source: 'IMDB', valueNum: 75 },
      { source: 'ROTTEN_TOMATOES', valueNum: 92 },
      { source: 'METACRITIC', valueNum: 68 },
    ],
    availability: [
      { service: 'Netflix', region: 'US', offerType: 'FLATRATE', deepLink: 'https://netflix.com/1' },
      { service: 'Hulu', region: 'US', offerType: 'FLATRATE', deepLink: null },
      { service: 'Netflix', region: 'GB', offerType: 'FLATRATE', deepLink: 'https://netflix.co.uk/1' },
    ],
  };

  it('maps a complete title to indexed doc structure', () => {
    const doc = toIndexedDoc(fullTitle);

    expect(doc.id).toBe('title-1');
    expect(doc.name).toBe('Test Movie');
    expect(doc.type).toBe('MOVIE');
    expect(doc.genres).toEqual(['Action', 'Comedy']);
    expect(doc.popularity).toBe(85.3);
  });

  it('flattens availability into nested objects', () => {
    const doc = toIndexedDoc(fullTitle);

    expect(doc.availability).toHaveLength(3);
    expect(doc.availability[0]).toEqual({
      service: 'Netflix',
      region: 'US',
      offerType: 'FLATRATE',
      deepLink: 'https://netflix.com/1',
    });
    // null deepLink becomes undefined
    expect(doc.availability[1]!.deepLink).toBeUndefined();
  });

  it('creates flattened keyword arrays for services and regions', () => {
    const doc = toIndexedDoc(fullTitle);

    expect(doc.availabilityServices).toEqual(expect.arrayContaining(['Netflix', 'Hulu']));
    expect(doc.availabilityServices).toHaveLength(2); // deduplicated
    expect(doc.availabilityRegions).toEqual(expect.arrayContaining(['US', 'GB']));
    expect(doc.availabilityRegions).toHaveLength(2);
  });

  it('maps external ratings to flattened fields', () => {
    const doc = toIndexedDoc(fullTitle);

    expect(doc.ratingsImdb).toBe(75);
    expect(doc.ratingsRottenTomatoes).toBe(92);
    expect(doc.ratingsMetacritic).toBe(68);
  });

  it('handles title with no availability', () => {
    const doc = toIndexedDoc({ ...fullTitle, availability: [] });

    expect(doc.availability).toEqual([]);
    expect(doc.availabilityServices).toEqual([]);
    expect(doc.availabilityRegions).toEqual([]);
  });

  it('handles title with no ratings', () => {
    const doc = toIndexedDoc({ ...fullTitle, externalRatings: [] });

    expect(doc.ratingsImdb).toBeUndefined();
    expect(doc.ratingsRottenTomatoes).toBeUndefined();
    expect(doc.ratingsMetacritic).toBeUndefined();
  });

  it('handles null popularity', () => {
    const doc = toIndexedDoc({ ...fullTitle, popularity: null });

    expect(doc.popularity).toBeUndefined();
  });

  it('handles missing availability and ratings fields', () => {
    const minimal = { id: 'min-1', name: 'Minimal', type: 'TV' };
    const doc = toIndexedDoc(minimal);

    expect(doc.id).toBe('min-1');
    expect(doc.availability).toEqual([]);
    expect(doc.availabilityServices).toEqual([]);
    expect(doc.ratingsImdb).toBeUndefined();
  });
});
