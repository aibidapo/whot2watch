'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useProfileId } from '@/hooks/useProfileId';

type FriendItem = {
  id: string;
  profileId: string;
  name: string;
  avatarUrl?: string;
  status: string;
  createdAt: string;
};

export default function FriendsPage() {
  const { profileId, loading: profileLoading, error: profileError, api } = useProfileId();
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [toProfileId, setToProfileId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadFriends() {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const json = await api.get<{ items: FriendItem[] }>(
        `/profiles/${profileId}/friends`,
      );
      setFriends(Array.isArray(json.items) ? json.items : []);
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' && err && 'message' in err
          ? String((err as Error).message)
          : 'Failed to load friends';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function sendRequest() {
    if (!profileId || !toProfileId) return;
    setError(null);
    try {
      const json = await api.post<{ friend?: FriendItem; error?: string }>(
        `/profiles/${profileId}/friends`,
        { toProfileId },
      );
      if (json.error) {
        setError(json.error);
      } else {
        setToProfileId('');
        await loadFriends();
      }
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' && err && 'message' in err
          ? String((err as Error).message)
          : 'Failed to send request';
      setError(msg);
    }
  }

  async function respond(friendId: string, accept: boolean) {
    setError(null);
    try {
      await api.patch(`/friends/${friendId}`, { accept });
      await loadFriends();
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' && err && 'message' in err
          ? String((err as Error).message)
          : 'Failed to respond';
      setError(msg);
    }
  }

  useEffect(() => {
    if (profileId) loadFriends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const pending = friends.filter((f) => f.status === 'REQUESTED');
  const accepted = friends.filter((f) => f.status === 'ACCEPTED');

  if (profileLoading) return <div className="text-muted p-8 text-center">Loading profile...</div>;
  if (profileError) return <div className="text-error-text p-8 text-center">{profileError}</div>;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Friends</h1>

      {/* Send request */}
      <Card>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
          Send Friend Request
        </h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-muted mb-1">Profile ID</label>
            <Input
              value={toProfileId}
              onChange={(e) => setToProfileId(e.target.value)}
              placeholder="Enter friend's profile ID"
            />
          </div>
          <Button onClick={sendRequest} disabled={!toProfileId}>
            Send Request
          </Button>
        </div>
      </Card>

      {error && <div className="text-error-text text-sm">{error}</div>}
      {loading && <div className="text-muted text-sm">Loading...</div>}

      {/* Pending requests */}
      {pending.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">Pending Requests</h2>
          <div className="grid gap-3">
            {pending.map((f) => (
              <Card key={f.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-border flex items-center justify-center text-sm font-medium">
                    {f.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{f.name}</div>
                    <Chip>Pending</Chip>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => respond(f.id, true)}>Accept</Button>
                  <Button variant="ghost" onClick={() => respond(f.id, false)}>
                    Reject
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Accepted friends */}
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">
          Friends {accepted.length > 0 ? `(${accepted.length})` : ''}
        </h2>
        <div className="grid gap-3">
          {accepted.map((f) => (
            <Card key={f.id} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-border flex items-center justify-center text-sm font-medium">
                {f.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-medium">{f.name}</div>
                <div className="text-xs text-muted">{f.profileId}</div>
              </div>
              <Chip selected className="ml-auto">
                Friends
              </Chip>
            </Card>
          ))}
          {accepted.length === 0 && !loading && (
            <div className="text-muted text-sm">
              No friends yet. Send a request to get started.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
