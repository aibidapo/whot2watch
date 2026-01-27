'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface ReferralData {
  code: string;
  userId: string;
  maxUses: number;
  redemptions: number;
}

export function InviteCard({ userId }: { userId: string }) {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', []);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`${apiBase}/v1/referrals/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, apiBase]);

  const inviteUrl = useMemo(() => {
    if (!data) return '';
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/invite?ref=${data.code}`;
  }, [data]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = inviteUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [inviteUrl]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Whot2Watch!',
          text: 'Check out Whot2Watch — find what to watch on your streaming services.',
          url: inviteUrl,
        });
      } catch {}
    } else {
      handleCopy();
    }
  }, [inviteUrl, handleCopy]);

  if (loading || !data) return null;

  return (
    <Card>
      <div style={{ padding: '1rem' }}>
        <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Invite Friends</h3>
        <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.75rem' }}>
          Share your referral code and earn rewards when friends sign up.
        </p>
        <div
          style={{
            background: '#f3f4f6',
            padding: '0.5rem 1rem',
            borderRadius: 8,
            fontFamily: 'monospace',
            fontSize: '1.25rem',
            fontWeight: 700,
            textAlign: 'center',
            letterSpacing: '0.15em',
            marginBottom: '0.75rem',
          }}
        >
          {data.code}
        </div>
        <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.75rem', textAlign: 'center' }}>
          {data.redemptions} / {data.maxUses} uses
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={handleCopy} style={{ flex: 1 }}>
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
          <Button onClick={handleShare} style={{ flex: 1 }}>
            Share
          </Button>
        </div>
      </div>
    </Card>
  );
}
