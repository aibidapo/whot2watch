'use client';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { STREAMING_SERVICES } from '@/constants/onboarding';

type Sub = { id: string; service: string; region?: string };

export default function SubsPage() {
  const [profileId, setProfileId] = useState('');
  const [service, setService] = useState('');
  const [region, setRegion] = useState('');
  const [items, setItems] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', []);

  async function list() {
    if (!profileId) return;
    const res = await fetch(`${apiBase}/profiles/${profileId}/subscriptions`);
    const json = await res.json();
    setItems(json.items || []);
  }
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
  async function del(svc: string) {
    if (!profileId) return;
    await fetch(`${apiBase}/profiles/${profileId}/subscriptions`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ service: svc }),
    });
    await list();
  }

  useEffect(() => {
    /* no-op */
  }, []);

  return (
    <div className="grid gap-4">
      <Card className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-sm text-muted">Profile ID</label>
          <Input
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            className="mt-1"
          />
        </div>
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
          <Input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="mt-1"
            placeholder="US"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={upsert}>Save</Button>
          <Button variant="secondary" onClick={list}>
            Refresh
          </Button>
        </div>
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
