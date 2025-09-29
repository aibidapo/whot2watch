import { describe, it, expect } from 'vitest';
import { parseRatingValueTo100, mapOmdbRatings } from './omdb';

describe('omdb ratings parsing', () => {
  it('parses IMDB 7.7/10 to 77', () => {
    expect(parseRatingValueTo100('IMDB', '7.7/10')).toBe(77);
  });
  it('parses Rotten Tomatoes 95% to 95', () => {
    expect(parseRatingValueTo100('ROTTEN_TOMATOES', '95%')).toBe(95);
  });
  it('parses Metacritic 82/100 to 82', () => {
    expect(parseRatingValueTo100('METACRITIC', '82/100')).toBe(82);
  });
  it('maps OMDb Ratings array', () => {
    const json = {
      Ratings: [
        { Source: 'Internet Movie Database', Value: '8.2/10' },
        { Source: 'Rotten Tomatoes', Value: '91%' },
        { Source: 'Metacritic', Value: '74/100' },
      ],
    };
    const mapped = mapOmdbRatings(json);
    const by = Object.fromEntries(mapped.map((r) => [r.source, r.valueNum]));
    expect(by.INTERNET_MOVIE_DATABASE ?? by.IMDB).toBeDefined();
    expect(by.ROTTEN_TOMATOES).toBe(91);
    expect(by.METACRITIC).toBe(74);
  });
});
