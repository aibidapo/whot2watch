/* eslint-disable no-console */
const TRAKT_BASE = 'https://api.trakt.tv';
const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID || process.env.TRAKT_API_KEY;

if (!TRAKT_CLIENT_ID) {
  console.warn('[trakt] TRAKT_CLIENT_ID is not set; trakt trending ingest will be skipped.');
}

async function traktGet(path, params = {}) {
  if (!TRAKT_CLIENT_ID) throw new Error('TRAKT_CLIENT_ID not set');
  let url = `${TRAKT_BASE}${path}`;
  const q = new URLSearchParams({ ...params });
  if (q.toString()) url += `?${q.toString()}`;
  const res = await fetch(url, {
    headers: {
      'trakt-api-version': '2',
      'trakt-api-key': TRAKT_CLIENT_ID,
    },
  });
  if (!res.ok) throw new Error(`[trakt] ${res.status} ${await res.text()}`);
  return res.json();
}

function toMinimal(item, mediaType) {
  const core = mediaType === 'tv' ? item.show : item.movie;
  if (!core) return undefined;
  const ids = core.ids || {};
  const name = core.title || 'Unknown';
  const year = typeof core.year === 'number' ? core.year : undefined;
  const tmdbId = typeof ids.tmdb === 'number' ? ids.tmdb : undefined;
  const imdbId = typeof ids.imdb === 'string' ? ids.imdb : undefined;
  return {
    name,
    releaseYear: year,
    type: mediaType === 'tv' ? 'SHOW' : 'MOVIE',
    tmdbId,
    imdbId,
    watchers: typeof item.watchers === 'number' ? item.watchers : undefined,
  };
}

// Fetch trending (watchers) from Trakt. Pages of up to 100 items.
async function fetchTraktTrending(mediaType = 'movie', pages = 1) {
  const out = [];
  for (let p = 1; p <= pages; p++) {
    const data = await traktGet(`/${mediaType === 'tv' ? 'shows' : 'movies'}/trending`, {
      page: String(p),
      limit: '100',
    });
    for (const it of data || []) {
      const m = toMinimal(it, mediaType);
      if (m) out.push(m);
    }
  }
  return out;
}

module.exports = { fetchTraktTrending };
