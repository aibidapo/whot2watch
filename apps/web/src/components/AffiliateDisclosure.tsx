'use client';
import { useEffect, useMemo, useState } from 'react';

export function AffiliateDisclosure() {
  const [text, setText] = useState<string | null>(null);
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', []);

  useEffect(() => {
    fetch(`${apiBase}/v1/affiliates/disclosure`)
      .then((r) => r.json())
      .then((data: { enabled: boolean; text: string | null }) => {
        if (data.enabled && data.text) setText(data.text);
      })
      .catch(() => {});
  }, [apiBase]);

  if (!text) return null;

  return (
    <div
      style={{
        fontSize: '0.75rem',
        color: '#999',
        padding: '0.5rem 0',
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  );
}
