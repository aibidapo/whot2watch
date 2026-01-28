'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import {
  KNOWN_REGIONS,
  REGION_SERVICE_PRESETS,
  STREAMING_SERVICES,
} from '@/constants/onboarding';
import { useProfileId } from '@/hooks/useProfileId';

type Sub = { id: string; service: string; region?: string };

export default function SubsPage() {
  const { profileId, loading: profileLoading, error: profileError, apiBase } = useProfileId();
  const [service, setService] = useState('');
  const [region, setRegion] = useState('');
  const [items, setItems] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function list() {
    if (!profileId) return;
    try {
      const res = await fetch(`${apiBase}/profiles/${profileId}/subscriptions`);
      if (!res.ok) {
        throw new Error(`Failed to load subscriptions: ${res.status}`);
      }
      const json = await res.json();
      setItems(json.items || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load subscriptions';
      setError(message);
    }
  }

  // Auto-fetch subscriptions when profileId changes
  useEffect(() => {
    if (profileId) list();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  async function upsert() {
    if (!profileId || !service) return;
    setLoading(true);
    setError(null);
    try {
      await fetch(`${apiBase}/profiles/${profileId}/subscriptions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ service, region: region || undefined }),
      });
      await list();
    } catch (error_: unknown) {
      const message =
        typeof error_ === 'object' && error_ && 'message' in error_
          ? String((error_ as any).message)
          : 'Update failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function addAllForRegion() {
    if (!profileId || !region) return;
    const presets = REGION_SERVICE_PRESETS[region];
    if (!presets) return;
    setLoading(true);
    setError(null);
    try {
      const existing = new Set(items.map((i) => i.service));
      for (const svc of presets) {
        if (!existing.has(svc)) {
          await fetch(`${apiBase}/profiles/${profileId}/subscriptions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ service: svc, region }),
          });
        }
      }
      await list();
    } catch (error_: unknown) {
      const message =
        typeof error_ === 'object' && error_ && 'message' in error_
          ? String((error_ as any).message)
          : 'Update failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function del(svc: string) {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/profiles/${profileId}/subscriptions`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ service: svc }),
      });
      if (!res.ok) {
        throw new Error(`Failed to remove subscription: ${res.status}`);
      }
      await list();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to remove subscription';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (profileLoading) return <div className="text-muted p-8 text-center">Loading profile...</div>;
  if (profileError) return <div className="text-error-text p-8 text-center">{profileError}</div>;

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
      <Card className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-sm text-muted">Service</label>
          <Select value={service} onChange={(e) => setService(e.target.value)} className="mt-1">
            <option value="">Select</option>
            {STREAMING_SERVICES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-sm text-muted">Region</label>
          <Select value={region} onChange={(e) => setRegion(e.target.value)} className="mt-1">
            <option value="">Select</option>
            {KNOWN_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button onClick={upsert}>Save</Button>
          <Button variant="secondary" onClick={list}>
            Refresh
          </Button>
        </div>
        {region && REGION_SERVICE_PRESETS[region] && (
          <div className="md:col-span-2">
            <Button variant="secondary" onClick={addAllForRegion}>
              Add all for {region}
            </Button>
          </div>
        )}
      </Card>
      {loading && <div className="text-muted">Saving…</div>}
      {error && <div className="text-error-text">{error}</div>}
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="p-3 text-xs font-medium text-muted uppercase tracking-wide">Service</th>
              <th className="p-3 text-xs font-medium text-muted uppercase tracking-wide">Region</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id} className={`border-t border-border hover:bg-table-hover transition-colors ${i % 2 === 1 ? 'bg-table-stripe' : ''}`}>
                <td className="p-3">{it.service}</td>
                <td className="p-3">{it.region || '-'}</td>
                <td className="p-3 text-right">
                  <Button variant="ghost" onClick={() => del(it.service)}>
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="p-3 text-muted" colSpan={3}>
                  No subscriptions
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
