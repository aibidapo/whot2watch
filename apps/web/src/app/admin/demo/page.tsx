'use client';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';

interface DemoDashboard {
  totalUsers: number;
  premiumUsers: number;
  totalReferrals: number;
  topTrending: { name: string; score: number }[];
}

export default function AdminDemoPage() {
  const [data, setData] = useState<DemoDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', []);

  useEffect(() => {
    fetch(`${apiBase}/v1/admin/demo-dashboard`)
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 403 ? 'Admin access required' : 'Failed to load');
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [apiBase]);

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        Demo Dashboard
      </h1>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <Card>
              <div style={{ padding: '1rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.875rem', color: '#666' }}>Total Users</p>
                <p style={{ fontSize: '2rem', fontWeight: 700 }}>{data.totalUsers}</p>
              </div>
            </Card>
            <Card>
              <div style={{ padding: '1rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.875rem', color: '#666' }}>Premium Users</p>
                <p style={{ fontSize: '2rem', fontWeight: 700 }}>{data.premiumUsers}</p>
              </div>
            </Card>
            <Card>
              <div style={{ padding: '1rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.875rem', color: '#666' }}>Total Referrals</p>
                <p style={{ fontSize: '2rem', fontWeight: 700 }}>{data.totalReferrals}</p>
              </div>
            </Card>
          </div>

          <Card>
            <div style={{ padding: '1rem' }}>
              <h2 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Top Trending</h2>
              {data.topTrending.length === 0 ? (
                <p style={{ color: '#888' }}>No trending data yet</p>
              ) : (
                <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
                  {data.topTrending.map((t, i) => (
                    <li key={i} style={{ padding: '0.25rem 0', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{t.name}</span>
                      <span style={{ color: '#888' }}>{t.score.toFixed(1)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Card>
        </>
      )}
    </main>
  );
}
