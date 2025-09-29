/* eslint-disable no-console */
const OMDB_API_KEY = process.env.OMDB_API_KEY;

/* c8 ignore start */
async function fetchOmdbByImdb(imdbId) {
  if (!OMDB_API_KEY) throw new Error('OMDB_API_KEY is not set');
  const url = `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(
    OMDB_API_KEY,
  )}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`omdb ${res.status} ${await res.text()}`);
  const json = await res.json();
  if (json.Response === 'False') throw new Error(`omdb error: ${json.Error || 'unknown'}`);
  return json;
}
/* c8 ignore stop */

function parseRatingValueTo100(source, valueText) {
  if (typeof valueText !== 'string') return undefined;
  const v = valueText.trim();
  if (/imdb/i.test(source)) {
    // e.g., "7.7/10" → 77
    const m = v.match(/([0-9]+(?:\.[0-9]+)?)\s*\/\s*10/);
    if (m) return Math.round(parseFloat(m[1]) * 10);
  } else if (/rotten(?:\s|_)*tomatoes/i.test(source)) {
    // e.g., "95%" → 95
    const m = v.match(/([0-9]{1,3})%/);
    if (m) return parseInt(m[1], 10);
  } else if (/metacritic/i.test(source)) {
    // e.g., "82/100" → 82
    const m = v.match(/([0-9]{1,3})\s*\/\s*100/);
    if (m) return parseInt(m[1], 10);
  }
  return undefined;
}

function mapOmdbRatings(omdbJson) {
  const out = [];
  const arr = Array.isArray(omdbJson?.Ratings) ? omdbJson.Ratings : [];
  for (const r of arr) {
    const rawSource = String(r.Source || '');
    let source;
    if (/internet\s+movie\s+database/i.test(rawSource)) source = 'IMDB';
    else if (/rotten(?:\s|_)*tomatoes/i.test(rawSource)) source = 'ROTTEN_TOMATOES';
    else if (/metacritic/i.test(rawSource)) source = 'METACRITIC';
    else source = rawSource.toUpperCase().replace(/\s+/g, '_');
    const valueText = String(r.Value || '');
    const valueNum = parseRatingValueTo100(source, valueText);
    out.push({ source, valueText, valueNum });
  }
  return out;
}

module.exports = { fetchOmdbByImdb, mapOmdbRatings, parseRatingValueTo100 };
