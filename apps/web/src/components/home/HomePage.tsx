'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import createClient from 'clients/rest/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Thumb } from '@/components/ui/Thumb';
import { Chip } from '@/components/ui/Chip';

type SearchItem = {
  id: string;
  name: string;
  type?: string;
  releaseYear?: number;
  posterUrl?: string;
  backdropUrl?: string;
  availabilityServices?: string[];
  availabilityRegions?: string[];
  voteAverage?: number;
  ratingsImdb?: number;
  ratingsRottenTomatoes?: number;
  ratingsMetacritic?: number;
};

function escapeHtml(s: string) {
  return s.replaceAll(
    /["&'<>]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function highlight(text: string, term: string) {
  if (!term) return escapeHtml(text);
  try {
    const safe = term.replaceAll(/[$()*+./?[\\\]^{|}-]/g, String.raw`\$&`);
    const re = new RegExp(`(${safe})`, 'ig');
    return escapeHtml(text).replaceAll(re as unknown as string, '<mark>$1</mark>');
  } catch {
    return escapeHtml(text);
  }
}

function buildSearchQuery(params: {
  q: string;
  service: string;
  regions: string[];
  size: number;
  from: number;
  hasRatings: boolean;
  minRating: number | '';
  minImdb: number | '';
  minRt: number | '';
  minMc: number | '';
}): string {
  const out = new URLSearchParams();
  const add = (key: string, val: string | number | undefined) => {
    if (val === undefined || val === '') return;
    out.set(key, String(val));
  };
  add('size', params.size);
  add('from', params.from);
  if (params.q) add('q', params.q);
  if (params.service) out.append('service', params.service);
  for (const r of params.regions || []) {
    if (r) out.append('region', r);
  }
  if (params.hasRatings) add('hasRatings', 'true');
  const addNum = (key: string, value: number | '') => {
    if (value === '') return;
    const n = Number(value);
    if (Number.isFinite(n)) add(key, Math.min(Math.max(n, 0), 100));
  };
  addNum('minRating', params.minRating);
  addNum('minImdb', params.minImdb);
  addNum('minRt', params.minRt);
  addNum('minMc', params.minMc);
  return out.toString();
}

export function HomePage() {
  const searchParams = useSearchParams();
  const [q, setQ] = useState('');
  const [service, setService] = useState<string>('');
  const defaultRegionOptions = useMemo(
    () =>
      (process.env.NEXT_PUBLIC_DEFAULT_REGIONS || 'US')
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    [],
  );
  const [regions, setRegions] = useState<string[]>(defaultRegionOptions);
  const [region, setRegion] = useState<string>((defaultRegionOptions[0] || 'US').toUpperCase());
  const [items, setItems] = useState<SearchItem[]>([]);
  const [from, setFrom] = useState(0);
  const size = 20;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRatings, setHasRatings] = useState(false);
  const [minRating, setMinRating] = useState<number | ''>('');
  const [minImdb, setMinImdb] = useState<number | ''>('');
  const [minRt, setMinRt] = useState<number | ''>('');
  const [minMc, setMinMc] = useState<number | ''>('');

  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', []);
  const api = useMemo(() => createClient({ baseUrl: `${apiBase}/v1` }), [apiBase]);

  async function runSearch() {
    setLoading(true);
    setError(null);
    const query = buildSearchQuery({
      q,
      service,
      regions,
      size,
      from,
      hasRatings,
      minRating,
      minImdb,
      minRt,
      minMc,
    });
    try {
      const json: any = await api.get(`/search?${query}`);
      const page: SearchItem[] = Array.isArray(json.items) ? json.items : [];
      setItems((prev) => (from === 0 ? page : [...prev, ...page]));
    } catch (error_: unknown) {
      const message =
        typeof error_ === 'object' && error_ && 'message' in error_
          ? String((error_ as any).message)
          : 'Search failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const qp = searchParams.get('q') || '';
    if (qp !== q) {
      setQ(qp);
      setFrom(0);
    }
    // Derive region(s) from URL if present
    const urlRegion = searchParams.get('region');
    if (urlRegion) {
      const list = urlRegion
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      if (list.length) {
        setRegions(list);
        if (!list.includes(region)) setRegion(list[0]);
        setFrom(0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Sync region(s) to URL for shareable state
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (regions.length) params.set('region', regions.join(','));
      else params.delete('region');
      const next = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', next);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions]);

  useEffect(() => {
    const t = setTimeout(() => {
      runSearch();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, service, regions, from, hasRatings, minRating, minImdb, minRt, minMc]);

  // Preload trending (no query) separately for hero section
  const [trending, setTrending] = useState<SearchItem[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const regionParam = region || defaultRegionOptions[0] || 'US';
        const json = await api.get(`/trending?region=${encodeURIComponent(regionParam)}`);
        const items = Array.isArray((json as any).items) ? (json as any).items : [];
        setTrending(items.slice(0, 4));
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, defaultRegionOptions]);

  return (
    <div className="grid gap-6">
      {/* Hero */}
      <section
        className="rounded-xl border border-slate-200 p-6"
        style={{
          background: 'linear-gradient(120deg, rgba(106,227,255,0.10), rgba(167,139,250,0.10))',
        }}
      >
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold mb-2">Discover what to watch</h1>
          <p className="text-slate-500 mb-4">Personalized picks from all your services.</p>
          <div className="flex gap-3">
            <a href="#search">
              <Button>Start Exploring</Button>
            </a>
            <Link href="/subscriptions">
              <Button variant="secondary">Connect Services</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Search */}
      <Card id="search">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="col-span-2">
            <label className="block text-sm text-slate-500">Query</label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search titles..."
              className="mt-1"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-500">Service</label>
            <Select
              value={service}
              onChange={(e) => {
                setService(e.target.value);
                setFrom(0);
              }}
              className="mt-1"
            >
              <option value="">Any</option>
              <option>NETFLIX</option>
              <option>DISNEY_PLUS</option>
              <option>HULU</option>
              <option>MAX</option>
            </Select>
          </div>
          <div>
            <label className="block text-sm text-slate-500">Region</label>
            <Select
              value={region}
              onChange={(e) => {
                const r = e.target.value;
                setRegion(r);
                setRegions(r ? [r] : []);
                setFrom(0);
              }}
              className="mt-1"
            >
              <option value="">Any</option>
              {defaultRegionOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm text-slate-500">Regions (multi)</label>
            <Input
              className="mt-1"
              placeholder="US,CA,GB"
              value={regions.join(',')}
              onChange={(e) => {
                const list = e.target.value
                  .split(',')
                  .map((s) => s.trim().toUpperCase())
                  .filter(Boolean);
                setRegions(list.length ? list : ['US']);
                if (!list.includes(region)) setRegion((list[0] || 'US').toUpperCase());
                setFrom(0);
              }}
            />
          </div>
          <div className="flex items-center gap-2 mt-2 md:mt-0">
            <input
              id="hasRatings"
              type="checkbox"
              checked={hasRatings}
              onChange={(e) => {
                setHasRatings(e.target.checked);
                setFrom(0);
              }}
            />
            <label htmlFor="hasRatings" className="text-sm text-slate-500">
              Has ratings
            </label>
          </div>
          <div className="flex items-center gap-2 mt-2 md:mt-0">
            <label htmlFor="minRating" className="text-sm text-slate-500">
              Min rating
            </label>
            <Input
              id="minRating"
              type="number"
              min={0}
              max={100}
              step={1}
              value={minRating}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') {
                  setMinRating('');
                  setFrom(0);
                  return;
                }
                const n = Number(v);
                if (Number.isFinite(n)) {
                  const clamped = Math.min(Math.max(n, 0), 100);
                  setMinRating(clamped);
                  setFrom(0);
                }
              }}
              className="w-24"
            />
          </div>
          <div className="flex items-center gap-2 mt-2 md:mt-0">
            <label htmlFor="minImdb" className="text-sm text-slate-500">
              Min IMDB
            </label>
            <Input
              id="minImdb"
              type="number"
              min={0}
              max={100}
              step={1}
              value={minImdb}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') {
                  setMinImdb('');
                  setFrom(0);
                  return;
                }
                const n = Number(v);
                if (Number.isFinite(n)) {
                  const clamped = Math.min(Math.max(n, 0), 100);
                  setMinImdb(clamped);
                  setFrom(0);
                }
              }}
              className="w-24"
            />
          </div>
          <div className="flex items-center gap-2 mt-2 md:mt-0">
            <label htmlFor="minRt" className="text-sm text-slate-500">
              Min RT
            </label>
            <Input
              id="minRt"
              type="number"
              min={0}
              max={100}
              step={1}
              value={minRt}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') {
                  setMinRt('');
                  setFrom(0);
                  return;
                }
                const n = Number(v);
                if (Number.isFinite(n)) {
                  const clamped = Math.min(Math.max(n, 0), 100);
                  setMinRt(clamped);
                  setFrom(0);
                }
              }}
              className="w-24"
            />
          </div>
          <div className="flex items-center gap-2 mt-2 md:mt-0">
            <label htmlFor="minMc" className="text-sm text-slate-500">
              Min MC
            </label>
            <Input
              id="minMc"
              type="number"
              min={0}
              max={100}
              step={1}
              value={minMc}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') {
                  setMinMc('');
                  setFrom(0);
                  return;
                }
                const n = Number(v);
                if (Number.isFinite(n)) {
                  const clamped = Math.min(Math.max(n, 0), 100);
                  setMinMc(clamped);
                  setFrom(0);
                }
              }}
              className="w-24"
            />
          </div>
        </div>
        <div className="mt-3 flex gap-3">
          <Button
            onClick={() => {
              setFrom(0);
              runSearch();
            }}
          >
            Search
          </Button>
          {loading && <span className="text-slate-500">Loading…</span>}
          {error && <span className="text-red-600">{error}</span>}
        </div>
      </Card>

      <section className="grid gap-3">
        <h2 className="text-lg font-medium">Results</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => (
            <Card key={it.id} className="hover:shadow-sm">
              <div className="flex gap-3">
                <Thumb
                  posterUrl={it.posterUrl}
                  backdropUrl={it.backdropUrl}
                  className="w-16 h-24 rounded-md overflow-hidden flex-shrink-0"
                />
                <div>
                  <div
                    className="text-base font-semibold"
                    dangerouslySetInnerHTML={{ __html: highlight(it.name, q) }}
                  />
                  <div className="text-sm text-slate-500">
                    {it.type || 'Unknown'} {it.releaseYear ? `• ${it.releaseYear}` : ''}
                    {typeof it.voteAverage === 'number' ? (
                      <span className="ml-2 text-amber-400">★ {it.voteAverage.toFixed(1)}</span>
                    ) : null}
                    {(typeof it.ratingsImdb === 'number' ||
                      typeof it.ratingsRottenTomatoes === 'number' ||
                      typeof it.ratingsMetacritic === 'number') && (
                      <span className="ml-2 text-slate-500">
                        {typeof it.ratingsImdb === 'number' && (
                          <>IMDB {(it.ratingsImdb / 10).toFixed(1)}</>
                        )}
                        {typeof it.ratingsRottenTomatoes === 'number' && (
                          <>
                            {typeof it.ratingsImdb === 'number' ? ' • ' : ''}RT{' '}
                            {it.ratingsRottenTomatoes}%
                          </>
                        )}
                        {typeof it.ratingsMetacritic === 'number' && (
                          <>
                            {typeof it.ratingsImdb === 'number' ||
                            typeof it.ratingsRottenTomatoes === 'number'
                              ? ' • '
                              : ''}
                            MC {it.ratingsMetacritic}
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  {Array.isArray(it.availabilityServices) && it.availabilityServices.length ? (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {it.availabilityServices.slice(0, 3).map((svc) => (
                        <Chip key={svc}>
                          {svc.replace('_', ' ')}
                          {Array.isArray(it.availabilityRegions) && it.availabilityRegions.length
                            ? ` • ${it.availabilityRegions[0]}`
                            : ''}
                        </Chip>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
          {items.length === 0 && !loading && (
            <div className="text-slate-500 text-sm">No results yet. Try adjusting filters.</div>
          )}
        </div>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => setFrom(from + size)} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      </section>

      {/* Trending */}
      <section className="grid gap-3">
        <h2 className="text-lg font-medium">Trending now</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {trending.map((it) => (
            <Card key={`t-${it.id}`} className="hover:shadow-sm">
              <Thumb
                posterUrl={it.posterUrl}
                backdropUrl={it.backdropUrl}
                className="w-full h-32 rounded-md overflow-hidden mb-3"
              />
              <div className="text-base font-semibold">{it.name}</div>
              <div className="text-sm text-slate-500">
                {it.type || 'Unknown'} {it.releaseYear ? `• ${it.releaseYear}` : ''}
                {typeof it.voteAverage === 'number' ? (
                  <span className="ml-2 text-amber-400">★ {it.voteAverage.toFixed(1)}</span>
                ) : null}
              </div>
              {Array.isArray(it.availabilityServices) && it.availabilityServices.length ? (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {it.availabilityServices.slice(0, 3).map((svc) => (
                    <Chip key={svc}>{svc.replace('_', ' ')}{region ? ` • ${region}` : ''}</Chip>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="text-2xl mb-2">🔍</div>
          <h3 className="text-base font-medium mb-1">Unified Search</h3>
          <p className="text-sm text-slate-500">
            Find movies and shows across all your streaming services, instantly.
          </p>
        </Card>
        <Card>
          <div className="text-2xl mb-2">✨</div>
          <h3 className="text-base font-medium mb-1">Daily Picks</h3>
          <p className="text-sm text-slate-500">
            Smart, fresh recommendations tailored to your subscriptions and taste.
          </p>
        </Card>
        <Card>
          <div className="text-2xl mb-2">🔔</div>
          <h3 className="text-base font-medium mb-1">Availability Alerts</h3>
          <p className="text-sm text-slate-500">
            Get notified the moment a title becomes available where you watch.
          </p>
        </Card>
      </section>
    </div>
  );
}
