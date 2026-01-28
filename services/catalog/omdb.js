/* eslint-disable no-console */
// For real-time HTTP cache/backoff, see server/mcp/client.ts (Redis-backed with exponential backoff).
// Batch ingestion scripts persist directly to Postgres; per-request caching is not beneficial here.
const OMDB_API_KEY = process.env.OMDB_API_KEY;

/* c8 ignore start */
async function fetchOmdbByImdb(imdbId) {
  if (!OMDB_API_KEY) throw new Error('OMDB_API_KEY is not set');
  const baseUrl = 'https://www.omdbapi.com/';
  const qs = (extra = '') =>
    `?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(OMDB_API_KEY)}${extra}`;

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(baseUrl + qs());
      if (!res.ok) throw new Error(`omdb ${res.status} ${await res.text()}`);
      const json = await res.json();
      if (json.Response === 'False') {
        const msg = String(json.Error || 'unknown');
        // OMDb sometimes returns transient "Error getting data."; retry a couple times
        if (/error getting data/i.test(msg) || /limit/i.test(msg)) {
          lastErr = new Error(`omdb error: ${msg}`);
        } else {
          throw new Error(`omdb error: ${msg}`);
        }
      } else {
        return json;
      }
    } catch (err) {
      lastErr = err;
    }
    // backoff 250ms, 500ms
    await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
  }
  throw lastErr || new Error('omdb error');
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
