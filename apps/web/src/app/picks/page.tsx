'use client';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Thumb } from '@/components/ui/Thumb'
import { Chip } from '@/components/ui/Chip'

type PickItem = {
  id: string
  name: string
  type?: string
  releaseYear?: number
  posterUrl?: string
  voteAverage?: number
  availabilityServices?: string[]
  watchUrl?: string
  reason?: string
};

export default function PicksPage() {
  const [profileId, setProfileId] = useState<string>(process.env.NEXT_PUBLIC_DEFAULT_PROFILE_ID || '');
  const [items, setItems] = useState<PickItem[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; name?: string }[]>([])
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', []);

  async function loadPicks() {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/picks/${profileId}`);
      const json = await res.json();
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load picks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/profiles`)
        const json = await res.json()
        if (Array.isArray(json.items)) setProfiles(json.items)
      } catch {}
    })()
  }, []);

  return (
    <div className="grid gap-4">
      <Card className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-sm text-slate-500">Profile ID</label>
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
              const envId = process.env.NEXT_PUBLIC_DEFAULT_PROFILE_ID || ''
              const found = profiles.find((p) => p.id === envId) || profiles[0]
              if (found?.id) setProfileId(found.id)
            }}
          >
            Use my profile
          </Button>
        </div>
      </Card>

      {loading && <div className="text-slate-500">Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <Card key={it.id} className="hover:shadow-sm">
            <div className="flex gap-3">
              <Thumb posterUrl={it.posterUrl} className="w-16 h-24 rounded-md overflow-hidden flex-shrink-0" />
              <div>
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
                      <Chip key={svc}>{svc.replace('_', ' ')}</Chip>
                    ))}
                  </div>
                ) : null}
                {it.watchUrl && (
                  <div className="mt-2">
                    <a className="text-sky-300 hover:underline" href={it.watchUrl} target="_blank" rel="noreferrer">Watch now →</a>
                  </div>
                )}
                {it.reason && <div className="text-sm text-slate-500 mt-2">{it.reason}</div>}
              </div>
            </div>
          </Card>
        ))}
        {items.length === 0 && !loading && (
          <div className="text-slate-500 text-sm">No picks loaded.</div>
        )}
      </div>
    </div>
  );
}
