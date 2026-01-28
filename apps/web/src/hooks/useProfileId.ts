'use client';
import { useEffect, useMemo, useState } from 'react';
import createClient from 'clients/rest/client';
import { STORAGE_KEY_PROFILE_ID } from '@/constants/onboarding';

export function useProfileId() {
  const [profileId, setProfileId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', []);
  const api = useMemo(() => createClient({ baseUrl: `${apiBase}/v1` }), [apiBase]);

  useEffect(() => {
    (async () => {
      try {
        // 1. Check localStorage
        const stored = localStorage.getItem(STORAGE_KEY_PROFILE_ID);
        if (stored) {
          setProfileId(stored);
          setLoading(false);
          return;
        }

        // 2. Fall back to env var
        const envId = process.env.NEXT_PUBLIC_DEFAULT_PROFILE_ID;
        if (envId) {
          setProfileId(envId);
          localStorage.setItem(STORAGE_KEY_PROFILE_ID, envId);
          setLoading(false);
          return;
        }

        // 3. Fall back to API /profiles
        const json = await api.get<{ items: { id: string }[] }>('/profiles');
        const first = Array.isArray(json.items) ? json.items[0] : undefined;
        if (first) {
          setProfileId(first.id);
          localStorage.setItem(STORAGE_KEY_PROFILE_ID, first.id);
        } else {
          setError('No profile found');
        }
      } catch {
        const envId = process.env.NEXT_PUBLIC_DEFAULT_PROFILE_ID;
        if (envId) {
          setProfileId(envId);
        } else {
          setError('Failed to discover profile');
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { profileId, loading, error, apiBase, api };
}
