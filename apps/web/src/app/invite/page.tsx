'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function InvitePage() {
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref') || '';
  const [redeemed, setRedeemed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', []);

  useEffect(() => {
    // Store ref code for post-signup redemption
    if (refCode) {
      try {
        localStorage.setItem('w2w_referral_code', refCode);
      } catch {}
    }
  }, [refCode]);

  async function handleRedeem() {
    const userId = localStorage.getItem('w2w_user_id');
    if (!userId || !refCode) {
      setError('Please sign up or log in first, then return to this page.');
      return;
    }
    try {
      const res = await fetch(`${apiBase}/v1/referrals/redeem`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: refCode, redeemedByUserId: userId }),
      });
      const data = await res.json();
      if (data.success) {
        setRedeemed(true);
        setError(null);
      } else {
        setError(data.error === 'ALREADY_REDEEMED' ? 'You already used this referral.' : data.error || 'Redemption failed');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  }

  return (
    <main style={{ maxWidth: 500, margin: '0 auto', padding: '2rem 1rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Welcome to Whot2Watch!
      </h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        You&apos;ve been invited by a friend. Find out what to watch on your streaming services.
      </p>

      {refCode && (
        <Card>
          <div style={{ padding: '1.5rem' }}>
            <p style={{ marginBottom: '0.5rem', color: '#444' }}>Referral code:</p>
            <p
              style={{
                fontFamily: 'monospace',
                fontSize: '1.5rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                marginBottom: '1rem',
              }}
            >
              {refCode}
            </p>
            {redeemed ? (
              <p style={{ color: '#16a34a', fontWeight: 600 }}>Referral applied!</p>
            ) : (
              <Button onClick={handleRedeem}>Apply Referral</Button>
            )}
            {error && <p style={{ color: '#b91c1c', marginTop: '0.5rem', fontSize: '0.875rem' }}>{error}</p>}
          </div>
        </Card>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <Button onClick={() => (window.location.href = '/onboarding')}>Get Started</Button>
      </div>
    </main>
  );
}
