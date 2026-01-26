'use client';
import { useEffect, useMemo, useState } from 'react';
import createClient from 'clients/rest/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Thumb } from '@/components/ui/Thumb';
import { Chip } from '@/components/ui/Chip';
import { STORAGE_KEY_PROFILE_ID } from '@/constants/onboarding';

type PickItem = {
  id: string;
  name: string;
  type?: string;
  releaseYear?: number;
  posterUrl?: string;
  voteAverage?: number;
  availabilityServices?: string[];
  watchUrl?: string;
  reason?: string;
  ratingsImdb?: number;
  ratingsRottenTomatoes?: number;
  ratingsMetacritic?: number;
};

export default function PicksPage() {
  const [profileId, setProfileId] = useState<string>('');
  const [items, setItems] = useState<PickItem[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; name?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', []);
  const [ratingsBias, setRatingsBias] = useState<number>(0);
  const api = useMemo(() => createClient({ baseUrl: `${apiBase}/v1` }), [apiBase]);
  const [autoLoaded, setAutoLoaded] = useState(false);

  async function loadPicks() {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`/picks/${profileId}`, `${apiBase}/v1`);
      if (Number.isFinite(ratingsBias) && ratingsBias > 0) {
        url.searchParams.set('ratingsBias', String(ratingsBias));
      }
      const json = await api.get<{ items: PickItem[] }>(url.pathname + url.search);
      setItems(Array.isArray((json as any).items) ? (json as any).items : []);
    } catch (error_: unknown) {
      const message =
        typeof error_ === 'object' && error_ && 'message' in error_
          ? String((error_ as any).message)
          : 'Failed to load picks';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_PROFILE_ID);
    const id = stored || process.env.NEXT_PUBLIC_DEFAULT_PROFILE_ID || '';
    if (id) {
      setProfileId(id);
      setAutoLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (autoLoaded && profileId) {
      loadPicks();
      setAutoLoaded(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoaded, profileId]);

  useEffect(() => {
    (async () => {
      try {
        const json = await api.get<{ items: { id: string; name?: string }[] }>(`/profiles`);
        if (Array.isArray(json.items)) setProfiles(json.items);
      } catch {}
    })();
  }, []);

  return (
    <div className="grid gap-4">
      <Card className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-sm text-muted">Profile ID</label>
          <Input
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            className="mt-1"
            placeholder="00000000-0000-0000-0000-000000000000"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={loadPicks}>Load Picks</Button>
          <Button
            variant="secondary"
            onClick={() => {
              const envId = process.env.NEXT_PUBLIC_DEFAULT_PROFILE_ID || '';
              const found = profiles.find((p) => p.id === envId) || profiles[0];
              if (found?.id) setProfileId(found.id);
            }}
          >
            Use my profile
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="ratingsBias" className="text-sm text-muted">
            Ratings bias
          </label>
          <input
            id="ratingsBias"
            type="range"
            min={0}
            max={3}
            step={0.5}
            value={ratingsBias}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) setRatingsBias(Math.min(Math.max(n, 0), 3));
            }}
            className="w-48"
          />
          <span className="text-sm text-muted">{ratingsBias.toFixed(1)}</span>
        </div>
      </Card>

      {loading && <div className="text-muted">Loading…</div>}
      {error && <div className="text-error-text">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <Card key={it.id} interactive>
            <div className="flex gap-3">
              <Thumb
                posterUrl={it.posterUrl}
                className="w-16 h-24 rounded-md overflow-hidden flex-shrink-0"
              />
              <div>
                <div className="text-base font-semibold">{it.name}</div>
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
                    <Chip>
                      {(it.availabilityServices[0] || '').replace('_', ' ')}
                      {it.availabilityServices.length > 1
                        ? ` +${it.availabilityServices.length - 1}`
                        : ''}
                    </Chip>
                  </div>
                ) : null}
                {it.watchUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <a
                      className="text-brand-cyan hover:underline"
                      href={it.watchUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        try {
                          // lightweight client-side beacon to API
                          navigator.sendBeacon?.(
                            `${apiBase}/analytics`,
                            new Blob(
                              [
                                JSON.stringify({
                                  event: 'pick_watch_now_clicked',
                                  titleId: it.id,
                                  provider:
                                    Array.isArray(it.availabilityServices) &&
                                    it.availabilityServices.length
                                      ? it.availabilityServices[0]
                                      : undefined,
                                  deepLinkUsed: true,
                                }),
                              ],
                              { type: 'application/json' },
                            ),
                          );
                        } catch {}
                      }}
                    >
                      Watch now →
                    </a>
                    {Array.isArray(it.availabilityServices) && it.availabilityServices.length ? (
                      <Chip>{(it.availabilityServices[0] || '').replace('_', ' ')}</Chip>
                    ) : null}
                    <button
                      className="text-xs text-muted hover:text-foreground transition-colors"
                      onClick={() => {
                        try {
                          navigator.clipboard.writeText(it.watchUrl!);
                        } catch {}
                      }}
                    >
                      Copy link
                    </button>
                    <button
                      className="text-xs text-muted hover:text-foreground transition-colors"
                      onClick={async () => {
                        try {
                          const json = await api.post(`/profiles/${profileId}/lists`, {
                            name: 'My List',
                          });
                          const listId = json?.list?.id;
                          if (listId) {
                            await api.post(`/lists/${listId}/items`, { titleId: it.id });
                            navigator.sendBeacon?.(
                              `${apiBase}/analytics`,
                              new Blob(
                                [
                                  JSON.stringify({
                                    event: 'pick_add_to_list',
                                    titleId: it.id,
                                    rank: 0,
                                  }),
                                ],
                                { type: 'application/json' },
                              ),
                            );
                          }
                        } catch {}
                      }}
                    >
                      Add to List
                    </button>
                    <button
                      className="text-xs text-muted hover:text-foreground transition-colors"
                      onClick={async () => {
                        try {
                          await api.post(`/feedback`, {
                            profileId,
                            titleId: it.id,
                            action: 'DISLIKE',
                          });
                          navigator.sendBeacon?.(
                            `${apiBase}/analytics`,
                            new Blob(
                              [
                                JSON.stringify({
                                  event: 'pick_feedback',
                                  titleId: it.id,
                                  action: 'NOT_INTERESTED',
                                }),
                              ],
                              { type: 'application/json' },
                            ),
                          );
                        } catch {}
                      }}
                    >
                      Not interested
                    </button>
                  </div>
                )}
                {it.reason && <div className="text-sm text-muted mt-2">{it.reason}</div>}
              </div>
            </div>
          </Card>
        ))}
        {items.length === 0 && !loading && (
          <div className="text-muted text-sm">No picks loaded.</div>
        )}
      </div>
    </div>
  );
}
