/* eslint-disable no-console */
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY; // v3 key
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN; // v4 bearer token

if (!TMDB_API_KEY && !TMDB_ACCESS_TOKEN) {
  console.warn('[tmdb] Neither TMDB_API_KEY (v3) nor TMDB_ACCESS_TOKEN (v4) is set. Set one to fetch real data.');
}

async function tmdbGet(path, params = {}) {
  let url = `${TMDB_BASE}${path}`;
  const headers = {};
  if (TMDB_ACCESS_TOKEN) {
    headers['Authorization'] = `Bearer ${TMDB_ACCESS_TOKEN}`;
    // v4 does not use api_key query param
    if (Object.keys(params).length) {
      const q = new URLSearchParams({ language: 'en-US', ...params });
      url = `${url}?${q.toString()}`;
    }
  } else {
    const q = new URLSearchParams({ api_key: TMDB_API_KEY || '', language: 'en-US', ...params });
    url = `${url}?${q.toString()}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`[tmdb] ${res.status} ${await res.text()}`);
  return res.json();
}

function toTitle(result, mediaType) {
  const name = mediaType === 'tv' ? (result.name || result.original_name) : (result.title || result.original_title);
  const date = mediaType === 'tv' ? result.first_air_date : result.release_date;
  const year = date ? Number(String(date).slice(0, 4)) : undefined;
  return {
    tmdbId: result.id,
    name: name || 'Unknown',
    type: mediaType === 'tv' ? 'SHOW' : 'MOVIE',
    releaseYear: Number.isFinite(year) ? year : undefined
  };
}

async function fetchTrending(mediaType = 'movie', pages = 1) {
  const items = [];
  for (let p = 1; p <= pages; p++) {
    const data = await tmdbGet(`/trending/${mediaType}/week`, { page: String(p) });
    for (const r of data.results || []) items.push(toTitle(r, mediaType));
  }
  return items;
}

module.exports = { fetchTrending };
