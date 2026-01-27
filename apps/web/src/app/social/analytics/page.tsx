'use client';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface SocialAnalytics {
  topGenresAmongFriends: { genre: string; count: number }[];
  friendsWatchingNow: number;
  sharedTitles: number;
  topServicesAmongFriends: { service: string; count: number }[];
}

export default function SocialAnalyticsPage() {
  const [profileId, setProfileId] = useState<string>('');
  const [data, setData] = useState<SocialAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('w2w_profile_id');
      if (stored) setProfileId(stored);
    } catch {}
  }, []);

  useEffect(() => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    setPremiumRequired(false);
    fetch(`${apiBase}/v1/social/analytics/${profileId}`)
      .then(async (r) => {
        if (r.status === 403) {
          setPremiumRequired(true);
          return null;
        }
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then((d) => {
        if (d) setData(d);
      })
      .catch(() => setError('Failed to load social analytics'))
      .finally(() => setLoading(false));
  }, [profileId, apiBase]);

  if (premiumRequired) {
    return (
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>
          Social Analytics
        </h1>
        <Card>
          <div style={{ padding: '2rem' }}>
            <p style={{ marginBottom: '1rem', color: '#666' }}>
              Social Analytics is a premium feature. Upgrade to see insights about your friends&apos;
              viewing habits.
            </p>
            <Button onClick={() => (window.location.href = '/upgrade')}>Upgrade to Premium</Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        Social Analytics
      </h1>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Card>
            <div style={{ padding: '1rem' }}>
              <h2 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Friends Active (24h)</h2>
              <p style={{ fontSize: '2rem', fontWeight: 700 }}>{data.friendsWatchingNow}</p>
            </div>
          </Card>
          <Card>
            <div style={{ padding: '1rem' }}>
              <h2 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Shared Titles</h2>
              <p style={{ fontSize: '2rem', fontWeight: 700 }}>{data.sharedTitles}</p>
            </div>
          </Card>
          <Card>
            <div style={{ padding: '1rem' }}>
              <h2 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Top Genres Among Friends</h2>
              {data.topGenresAmongFriends.length === 0 ? (
                <p style={{ color: '#888' }}>No data yet</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {data.topGenresAmongFriends.map((g) => (
                    <li
                      key={g.genre}
                      style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}
                    >
                      <span>{g.genre}</span>
                      <strong>{g.count}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
          <Card>
            <div style={{ padding: '1rem' }}>
              <h2 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
                Top Services Among Friends
              </h2>
              {data.topServicesAmongFriends.length === 0 ? (
                <p style={{ color: '#888' }}>No data yet</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {data.topServicesAmongFriends.map((s) => (
                    <li
                      key={s.service}
                      style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}
                    >
                      <span>{s.service}</span>
                      <strong>{s.count}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
