'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useProfileId } from '@/hooks/useProfileId';

interface PlanStatus {
  plan: 'free' | 'premium';
  status: 'active' | 'trial' | 'cancelled' | 'expired';
  trialEndsAt: string | null;
  subscribedAt: string | null;
  cancelledAt: string | null;
  features: string[];
}

const FREE_FEATURES = [
  'Daily picks (5 titles)',
  'Basic search & filters',
  'Up to 5 lists',
  'Standard alerts',
  'Community access',
];

const PREMIUM_FEATURES = [
  'Unlimited daily picks',
  'Advanced filters (mood, combo)',
  'Unlimited lists',
  'Early alerts (priority notifications)',
  'Ad-free experience',
  'Social analytics dashboard',
  'Premium support',
];

export default function UpgradePage() {
  const { profileId: userId, loading: profileLoading, error: profileError, apiBase } = useProfileId();
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`${apiBase}/v1/plans/status/${userId}`)
      .then((r) => r.json())
      .then((data) => setPlanStatus(data))
      .catch(() => setError('Failed to load plan status'))
      .finally(() => setLoading(false));
  }, [userId, apiBase]);

  async function handleAction(action: 'trial' | 'subscribe' | 'cancel') {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/v1/plans/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok) {
        setPlanStatus(data);
      } else {
        setError(data.error || 'Action failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setActionLoading(false);
    }
  }

  const trialDaysLeft = planStatus?.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(planStatus.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  const isPremium = planStatus?.plan === 'premium';

  if (profileLoading) return <div className="text-muted p-8 text-center">Loading profile...</div>;
  if (profileError) return <div className="text-error-text p-8 text-center">{profileError}</div>;

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Upgrade Your Plan
      </h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Unlock premium features and get the most out of Whot2Watch.
      </p>

      {error && (
        <div
          style={{
            background: '#fee2e2',
            color: '#b91c1c',
            padding: '0.75rem 1rem',
            borderRadius: 8,
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      {planStatus?.status === 'trial' && trialDaysLeft !== null && (
        <div
          style={{
            background: '#dbeafe',
            color: '#1e40af',
            padding: '0.75rem 1rem',
            borderRadius: 8,
            marginBottom: '1rem',
          }}
        >
          Premium trial active — {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} remaining
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Free Plan */}
        <Card>
          <div style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>Free</h2>
            <p style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>
              $0<span style={{ fontSize: '0.875rem', color: '#999' }}>/month</span>
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {FREE_FEATURES.map((f) => (
                <li key={f} style={{ padding: '0.35rem 0', color: '#444' }}>
                  {f}
                </li>
              ))}
            </ul>
            {!isPremium && (
              <div style={{ marginTop: '1.5rem' }}>
                <Button disabled style={{ width: '100%', opacity: 0.5 }}>
                  Current Plan
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Premium Plan */}
        <Card>
          <div
            style={{
              padding: '1.5rem',
              border: '2px solid #22c55e',
              borderRadius: 8,
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: -12,
                right: 16,
                background: '#22c55e',
                color: '#fff',
                padding: '2px 12px',
                borderRadius: 99,
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              RECOMMENDED
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Premium
            </h2>
            <p style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>
              $4.99<span style={{ fontSize: '0.875rem', color: '#999' }}>/month</span>
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {PREMIUM_FEATURES.map((f) => (
                <li key={f} style={{ padding: '0.35rem 0', color: '#444' }}>
                  {f}
                </li>
              ))}
            </ul>
            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {isPremium ? (
                <>
                  <Button disabled style={{ width: '100%', opacity: 0.5 }}>
                    Current Plan
                  </Button>
                  <Button
                    onClick={() => handleAction('cancel')}
                    disabled={actionLoading}
                    style={{ width: '100%' }}
                  >
                    {actionLoading ? 'Cancelling...' : 'Cancel Subscription'}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => handleAction('trial')}
                    disabled={actionLoading || loading}
                    style={{ width: '100%' }}
                  >
                    {actionLoading ? 'Starting...' : 'Start 14-Day Free Trial'}
                  </Button>
                  <Button
                    onClick={() => handleAction('subscribe')}
                    disabled={actionLoading || loading}
                    style={{ width: '100%' }}
                  >
                    {actionLoading ? 'Subscribing...' : 'Subscribe Now'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>

      {planStatus && (
        <div style={{ marginTop: '2rem', color: '#888', fontSize: '0.875rem' }}>
          <p>
            Plan: <strong>{planStatus.plan}</strong> | Status: <strong>{planStatus.status}</strong>
            {planStatus.subscribedAt && (
              <> | Subscribed: {new Date(planStatus.subscribedAt).toLocaleDateString()}</>
            )}
          </p>
        </div>
      )}
    </main>
  );
}
