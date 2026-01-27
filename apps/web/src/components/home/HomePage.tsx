'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import createClient from 'clients/rest/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Thumb } from '@/components/ui/Thumb';
import { Chip } from '@/components/ui/Chip';
import { STORAGE_KEY_PROFILE_ID, STREAMING_SERVICES } from '@/constants/onboarding';
import { useNluParse, type NluEntities } from '@/hooks/useNluParse';

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
  yearMin?: number;
  yearMax?: number;
  runtimeMin?: number;
  runtimeMax?: number;
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
  add('yearMin', params.yearMin);
  add('yearMax', params.yearMax);
  add('runtimeMin', params.runtimeMin);
  add('runtimeMax', params.runtimeMax);
  return out.toString();
}

export function HomePage() {
  const searchParams = useSearchParams();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_PROFILE_ID);
    if (!stored) setNeedsOnboarding(true);
  }, []);

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
  const [showAdvanced, setShowAdvanced] = useState(false);

  // NLU search augment
  const nlu = useNluParse(q);
  const [nluApplied, setNluApplied] = useState<NluEntities | null>(null);
  const nluAppliedQueryRef = useRef<string>('');

  // Apply NLU-parsed entities to filters when available
  useEffect(() => {
    if (!nlu.isParsed || !nlu.entities || !nlu.cleanQuery) return;
    // Avoid re-applying for the same query
    if (nluAppliedQueryRef.current === q) return;
    nluAppliedQueryRef.current = q;

    const ent = nlu.entities;
    const applied: NluEntities = {};
    let didApply = false;

    if (ent.services && ent.services.length > 0) {
      const svc = ent.services[0]!;
      // Map NLU service name to STREAMING_SERVICES value
      const match = STREAMING_SERVICES.find(
        (s) => s.toLowerCase() === svc.toLowerCase() || svc.toLowerCase().includes(s.toLowerCase()),
      );
      if (match) {
        setService(match);
        applied.services = [match];
        didApply = true;
      }
    }

    if (ent.region) {
      setRegion(ent.region);
      setRegions([ent.region]);
      applied.region = ent.region;
      didApply = true;
    }

    if (ent.duration) {
      if (typeof ent.duration.max === 'number') {
        applied.duration = { ...applied.duration, max: ent.duration.max };
        didApply = true;
      }
      if (typeof ent.duration.min === 'number') {
        applied.duration = { ...applied.duration, min: ent.duration.min };
        didApply = true;
      }
    }

    if (ent.releaseYear) {
      if (typeof ent.releaseYear.min === 'number') {
        applied.releaseYear = { ...applied.releaseYear, min: ent.releaseYear.min };
        didApply = true;
      }
      if (typeof ent.releaseYear.max === 'number') {
        applied.releaseYear = { ...applied.releaseYear, max: ent.releaseYear.max };
        didApply = true;
      }
    }

    if (didApply) {
      setNluApplied(applied);
      // Replace query with cleaned version (entities stripped)
      setQ(nlu.cleanQuery);
      setFrom(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nlu.isParsed, nlu.entities, nlu.cleanQuery]);

  const clearNluFilter = useCallback(
    (key: keyof NluEntities) => {
      if (!nluApplied) return;
      const next = { ...nluApplied };
      delete next[key];

      // Reset the corresponding filter
      if (key === 'services') setService('');
      if (key === 'region') {
        setRegion((defaultRegionOptions[0] || 'US').toUpperCase());
        setRegions(defaultRegionOptions);
      }
      if (key === 'duration') {
        // No dedicated filter state for runtime in current UI (advanced filters unused here)
      }
      if (key === 'releaseYear') {
        // No dedicated filter state for year in current UI
      }

      const hasAny = Object.keys(next).length > 0;
      setNluApplied(hasAny ? next : null);
      setFrom(0);
    },
    [nluApplied, defaultRegionOptions],
  );

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
      yearMin: nluApplied?.releaseYear?.min,
      yearMax: nluApplied?.releaseYear?.max,
      runtimeMin: nluApplied?.duration?.min,
      runtimeMax: nluApplied?.duration?.max,
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
  }, [q, service, regions, from, hasRatings, minRating, minImdb, minRt, minMc, nluApplied]);

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
      {/* Onboarding banner */}
      {needsOnboarding && (
        <Card className="flex items-center justify-between gap-4 animate-fade-in-up">
          <p className="text-sm text-muted">
            Set up your taste profile for personalized picks.
          </p>
          <Link href="/onboarding">
            <Button>Get Started</Button>
          </Link>
        </Card>
      )}

      {/* Hero */}
      <section
        className="relative rounded-2xl border border-border p-8 md:p-12 overflow-hidden"
        style={{
          background: 'linear-gradient(120deg, rgba(106,227,255,0.10), rgba(167,139,250,0.10))',
        }}
      >
        {/* Decorative gradient orbs */}
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-brand-cyan/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-brand-purple/10 blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
            Discover what to <span className="brand-text">watch</span>
          </h1>
          <p className="text-muted text-lg mb-6">Personalized picks from all your services.</p>
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
            <label className="block text-xs font-medium text-muted uppercase tracking-wide">Query</label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search titles or try &quot;funny movies on Netflix&quot;..."
              className="mt-1"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted uppercase tracking-wide">Service</label>
            <Select
              value={service}
              onChange={(e) => {
                setService(e.target.value);
                setFrom(0);
              }}
              className="mt-1"
            >
              <option value="">Any</option>
              {STREAMING_SERVICES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted uppercase tracking-wide">Region</label>
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
        </div>

        {/* Advanced filters toggle */}
        <button
          type="button"
          className="mt-3 text-xs font-medium text-muted hover:text-foreground transition-colors"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? 'Hide' : 'Show'} advanced filters
        </button>

        {showAdvanced && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3 items-end animate-fade-in-up">
            <div>
              <label className="block text-xs font-medium text-muted uppercase tracking-wide">Regions (multi)</label>
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
            <div className="flex items-center gap-2">
              <input
                id="hasRatings"
                type="checkbox"
                checked={hasRatings}
                onChange={(e) => {
                  setHasRatings(e.target.checked);
                  setFrom(0);
                }}
              />
              <label htmlFor="hasRatings" className="text-xs font-medium text-muted uppercase tracking-wide">
                Has ratings
              </label>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="minRating" className="text-xs font-medium text-muted uppercase tracking-wide whitespace-nowrap">
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
            <div className="flex items-center gap-2">
              <label htmlFor="minImdb" className="text-xs font-medium text-muted uppercase tracking-wide whitespace-nowrap">
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
            <div className="flex items-center gap-2">
              <label htmlFor="minRt" className="text-xs font-medium text-muted uppercase tracking-wide whitespace-nowrap">
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
            <div className="flex items-center gap-2">
              <label htmlFor="minMc" className="text-xs font-medium text-muted uppercase tracking-wide whitespace-nowrap">
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
        )}

        <div className="mt-3 flex gap-3 items-center">
          <Button
            onClick={() => {
              setFrom(0);
              runSearch();
            }}
          >
            Search
          </Button>
          {loading && <span className="text-muted text-sm">Loading…</span>}
          {error && <span className="text-error-text text-sm">{error}</span>}
          {nlu.isLoading && <span className="text-muted text-xs">Parsing query…</span>}
        </div>

        {/* NLU-applied filter chips */}
        {nluApplied && Object.keys(nluApplied).length > 0 && (
          <div className="mt-3 flex gap-2 flex-wrap items-center">
            <span className="text-xs text-muted font-medium">AI-parsed:</span>
            {nluApplied.services && nluApplied.services.length > 0 && (
              <Chip>
                {nluApplied.services.join(', ')}
                <button
                  type="button"
                  onClick={() => clearNluFilter('services')}
                  className="ml-1 text-muted hover:text-foreground"
                  aria-label="Remove service filter"
                >
                  &times;
                </button>
              </Chip>
            )}
            {nluApplied.region && (
              <Chip>
                {nluApplied.region}
                <button
                  type="button"
                  onClick={() => clearNluFilter('region')}
                  className="ml-1 text-muted hover:text-foreground"
                  aria-label="Remove region filter"
                >
                  &times;
                </button>
              </Chip>
            )}
            {nluApplied.duration && (
              <Chip>
                {nluApplied.duration.max ? `Under ${nluApplied.duration.max} min` : ''}
                {nluApplied.duration.min ? `Over ${nluApplied.duration.min} min` : ''}
                <button
                  type="button"
                  onClick={() => clearNluFilter('duration')}
                  className="ml-1 text-muted hover:text-foreground"
                  aria-label="Remove duration filter"
                >
                  &times;
                </button>
              </Chip>
            )}
            {nluApplied.releaseYear && (
              <Chip>
                {nluApplied.releaseYear.min ? `From ${nluApplied.releaseYear.min}` : ''}
                {nluApplied.releaseYear.max ? `Before ${nluApplied.releaseYear.max}` : ''}
                <button
                  type="button"
                  onClick={() => clearNluFilter('releaseYear')}
                  className="ml-1 text-muted hover:text-foreground"
                  aria-label="Remove year filter"
                >
                  &times;
                </button>
              </Chip>
            )}
          </div>
        )}
      </Card>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Results</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => (
            <Card key={it.id} interactive>
              <div className="flex gap-3">
                <Thumb
                  posterUrl={it.posterUrl}
                  backdropUrl={it.backdropUrl}
                  className="w-16 h-24 rounded-lg overflow-hidden flex-shrink-0"
                />
                <div>
                  <div
                    className="text-base font-semibold"
                    dangerouslySetInnerHTML={{ __html: highlight(it.name, q) }}
                  />
                  <div className="text-sm text-muted">
                    {it.type || 'Unknown'} {it.releaseYear ? `• ${it.releaseYear}` : ''}
                    {typeof it.voteAverage === 'number' ? (
                      <span className="ml-2 text-amber-400">★ {it.voteAverage.toFixed(1)}</span>
                    ) : null}
                    {(typeof it.ratingsImdb === 'number' ||
                      typeof it.ratingsRottenTomatoes === 'number' ||
                      typeof it.ratingsMetacritic === 'number') && (
                      <span className="ml-2 text-muted">
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
            <div className="text-muted text-sm">No results yet. Try adjusting filters.</div>
          )}
        </div>
        <div className="mt-4 text-center">
          <Button variant="secondary" onClick={() => setFrom(from + size)} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      </section>

      {/* Trending */}
      <section className="grid gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Trending now</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {trending.map((it) => (
            <Card key={`t-${it.id}`} interactive className="p-0 overflow-hidden">
              <Thumb
                posterUrl={it.posterUrl}
                backdropUrl={it.backdropUrl}
                className="w-full h-40 overflow-hidden"
              />
              <div className="p-3">
                <div className="text-sm font-semibold">{it.name}</div>
                <div className="text-xs text-muted">
                  {it.type || 'Unknown'} {it.releaseYear ? `• ${it.releaseYear}` : ''}
                  {typeof it.voteAverage === 'number' ? (
                    <span className="ml-1 text-amber-400">★ {it.voteAverage.toFixed(1)}</span>
                  ) : null}
                </div>
                {Array.isArray(it.availabilityServices) && it.availabilityServices.length ? (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {it.availabilityServices.slice(0, 2).map((svc) => (
                      <Chip key={svc}>
                        {svc.replace('_', ' ')}
                        {region ? ` • ${region}` : ''}
                      </Chip>
                    ))}
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-chip-bg flex items-center justify-center text-2xl">🔍</div>
          <h3 className="text-base font-semibold mb-1">Unified Search</h3>
          <p className="text-sm text-muted">
            Find movies and shows across all your streaming services, instantly.
          </p>
        </Card>
        <Card className="p-6 text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-chip-bg flex items-center justify-center text-2xl">✨</div>
          <h3 className="text-base font-semibold mb-1">Daily Picks</h3>
          <p className="text-sm text-muted">
            Smart, fresh recommendations tailored to your subscriptions and taste.
          </p>
        </Card>
        <Card className="p-6 text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-chip-bg flex items-center justify-center text-2xl">🔔</div>
          <h3 className="text-base font-semibold mb-1">Availability Alerts</h3>
          <p className="text-sm text-muted">
            Get notified the moment a title becomes available where you watch.
          </p>
        </Card>
      </section>
    </div>
  );
}
