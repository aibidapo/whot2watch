'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Thumb } from '@/components/ui/Thumb';
import { useProfileId } from '@/hooks/useProfileId';

type TitleSummary = {
  id: string;
  name: string;
  type?: string;
  releaseYear?: number;
  posterUrl?: string;
  voteAverage?: number;
};

type FeedItem = {
  id: string;
  profileId: string;
  profileName: string;
  profileAvatarUrl?: string;
  action: string;
  title: TitleSummary;
  ts: string;
};

type FriendsPickItem = {
  title: TitleSummary;
  friendCount: number;
  friendNames: string[];
  latestTs: string;
};

type Tab = 'feed' | 'friends-picks';

export default function SocialPage() {
  const { profileId, loading: profileLoading, error: profileError, api } = useProfileId();
  const [tab, setTab] = useState<Tab>('feed');
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [picksItems, setPicksItems] = useState<FriendsPickItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);

  async function loadFeed(before?: string) {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (before) params.set('before', before);
      const json = await api.get<{ items: FeedItem[] }>(
        `/social/feed/${profileId}${params.toString() ? `?${params}` : ''}`,
      );
      const items = Array.isArray(json.items) ? json.items : [];
      setFeedItems((prev) => (before ? [...prev, ...items] : items));
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('503')) {
        setDisabled(true);
      } else {
        const msg =
          typeof err === 'object' && err && 'message' in err
            ? String((err as Error).message)
            : 'Failed to load feed';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadFriendsPicks() {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const json = await api.get<{ items: FriendsPickItem[] }>(
        `/social/friends-picks/${profileId}`,
      );
      setPicksItems(Array.isArray(json.items) ? json.items : []);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('503')) {
        setDisabled(true);
      } else {
        const msg =
          typeof err === 'object' && err && 'message' in err
            ? String((err as Error).message)
            : 'Failed to load friends picks';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!profileId) return;
    if (tab === 'feed') loadFeed();
    else loadFriendsPicks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, tab]);

  if (profileLoading) return <div className="text-muted p-8 text-center">Loading profile...</div>;
  if (profileError) return <div className="text-error-text p-8 text-center">{profileError}</div>;

  if (disabled) {
    return (
      <div className="grid gap-6">
        <h1 className="text-2xl font-bold tracking-tight">Social</h1>
        <Card className="text-center py-12">
          <p className="text-muted">Social features coming soon.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Social</h1>

      {/* Tab switcher */}
      <div className="flex gap-2">
        <Chip selected={tab === 'feed'} onClick={() => setTab('feed')}>
          Activity Feed
        </Chip>
        <Chip
          selected={tab === 'friends-picks'}
          onClick={() => setTab('friends-picks')}
        >
          Friends&apos; Picks
        </Chip>
      </div>

      {error && <div className="text-error-text text-sm">{error}</div>}
      {loading && <div className="text-muted text-sm">Loading...</div>}

      {/* Feed tab */}
      {tab === 'feed' && (
        <div className="grid gap-4">
          {feedItems.map((item) => (
            <Card key={item.id} className="animate-fade-in-up">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-border flex items-center justify-center text-sm font-medium flex-shrink-0">
                  {item.profileName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{item.profileName}</span>
                    <Chip selected>{item.action === 'LIKE' ? 'Liked' : 'Saved'}</Chip>
                    <span className="text-xs text-muted ml-auto">
                      {new Date(item.ts).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <Thumb
                      posterUrl={item.title.posterUrl}
                      className="w-12 h-18 rounded-md overflow-hidden flex-shrink-0"
                    />
                    <div>
                      <div className="font-semibold">{item.title.name}</div>
                      <div className="text-sm text-muted">
                        {item.title.type || 'Unknown'}
                        {item.title.releaseYear ? ` • ${item.title.releaseYear}` : ''}
                        {typeof item.title.voteAverage === 'number' ? (
                          <span className="ml-2 text-amber-400">
                            ★ {item.title.voteAverage.toFixed(1)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          {feedItems.length === 0 && !loading && (
            <div className="text-muted text-sm">
              No activity yet. Add friends to see their likes and saves here.
            </div>
          )}
          {feedItems.length > 0 && (
            <div className="text-center">
              <Button
                variant="secondary"
                onClick={() => {
                  const last = feedItems[feedItems.length - 1];
                  if (last) loadFeed(last.ts);
                }}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Friends' Picks tab */}
      {tab === 'friends-picks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {picksItems.map((item) => (
            <Card key={item.title.id} interactive className="animate-fade-in-up">
              <div className="flex gap-3">
                <Thumb
                  posterUrl={item.title.posterUrl}
                  className="w-16 h-24 rounded-md overflow-hidden flex-shrink-0"
                />
                <div>
                  <div className="font-semibold">{item.title.name}</div>
                  <div className="text-sm text-muted">
                    {item.title.type || 'Unknown'}
                    {item.title.releaseYear ? ` • ${item.title.releaseYear}` : ''}
                    {typeof item.title.voteAverage === 'number' ? (
                      <span className="ml-2 text-amber-400">
                        ★ {item.title.voteAverage.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Chip selected>
                      {item.friendCount} {item.friendCount === 1 ? 'friend' : 'friends'}
                    </Chip>
                  </div>
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {item.friendNames.map((name) => (
                      <Chip key={name}>{name}</Chip>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ))}
          {picksItems.length === 0 && !loading && (
            <div className="text-muted text-sm">
              No friends&apos; picks yet. When your friends like or save titles, their
              favorites will appear here.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
