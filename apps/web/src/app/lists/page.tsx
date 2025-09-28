'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

type List = { id: string; name: string; visibility?: string };

export default function ListsPage() {
  const [profileId, setProfileId] = useState('');
  const [name, setName] = useState('');
  const [lists, setLists] = useState<List[]>([]);
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', []);

  async function refresh() {
    if (!profileId) return;
    const res = await fetch(`${apiBase}/profiles/${profileId}/lists`);
    const json = await res.json();
    setLists(json.items || []);
  }
  async function create() {
    if (!profileId || !name) return;
    await fetch(`${apiBase}/profiles/${profileId}/lists`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setName('');
    await refresh();
  }

  return (
    <div className="grid gap-4">
      <Card className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-sm text-slate-500">Profile ID</label>
          <Input
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-500">Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={create}>Create</Button>
          <Button variant="secondary" onClick={refresh}>Refresh</Button>
        </div>
      </Card>
      <ul className="grid gap-2">
        {lists.map((l) => (
          <li key={l.id} className="card p-3">
            <span className="font-medium">{l.name}</span>
            {l.visibility ? <span className="text-slate-500"> — {l.visibility}</span> : null}
          </li>
        ))}
        {lists.length === 0 && <li className="text-slate-500 text-sm">No lists</li>}
      </ul>
    </div>
  );
}
