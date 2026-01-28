'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useProfileId } from '@/hooks/useProfileId';

type List = { id: string; name: string; visibility?: string };

export default function ListsPage() {
  const { profileId, loading: profileLoading, error: profileError, apiBase } = useProfileId();
  const [name, setName] = useState('');
  const [lists, setLists] = useState<List[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profileId) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  async function refresh() {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/profiles/${profileId}/lists`);
      if (!res.ok) {
        throw new Error(`Failed to load lists: ${res.status}`);
      }
      const json = await res.json();
      setLists(json.items || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load lists';
      setError(message);
    } finally {
      setLoading(false);
    }
  }
  async function create() {
    if (!profileId || !name) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/profiles/${profileId}/lists`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        throw new Error(`Failed to create list: ${res.status}`);
      }
      setName('');
      await refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create list';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleShare(listId: string) {
    const url = `${window.location.origin}/lists/${listId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(listId);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {});
  }

  if (profileLoading) return <div className="text-muted p-8 text-center">Loading profile...</div>;
  if (profileError) return <div className="text-error-text p-8 text-center">{profileError}</div>;

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold tracking-tight">My Lists</h1>
      {loading && <div className="text-muted">Loading…</div>}
      {error && <div className="text-error-text">{error}</div>}
      <Card className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-sm text-muted">Profile ID</label>
          <Input
            value={profileId}
            readOnly
            className="mt-1"
          />
        </div>
        <div>
          <label className="block text-sm text-muted">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
        </div>
        <div className="flex gap-2">
          <Button onClick={create}>Create</Button>
          <Button variant="secondary" onClick={refresh}>
            Refresh
          </Button>
        </div>
      </Card>
      <ul className="grid gap-2">
        {lists.map((l) => {
          const isShareable = l.visibility === 'PUBLIC' || l.visibility === 'COLLAB';
          return (
            <li
              key={l.id}
              className="card p-3 hover:bg-card-hover transition-colors duration-200 flex items-center justify-between gap-2"
            >
              <a href={`/lists/${l.id}`} className="font-medium hover:underline min-w-0 truncate">
                {l.name}
              </a>
              <div className="flex items-center gap-2 shrink-0">
                {l.visibility && <Chip>{l.visibility}</Chip>}
                {isShareable && (
                  <Button variant="ghost" onClick={() => handleShare(l.id)}>
                    {copiedId === l.id ? 'Copied!' : 'Share'}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
        {lists.length === 0 && <li className="text-muted text-sm">No lists</li>}
      </ul>
    </div>
  );
}
