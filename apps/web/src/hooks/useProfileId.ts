'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import createClient from 'clients/rest/client';
import { STORAGE_KEY_PROFILE_ID } from '@/constants/onboarding';

export function useProfileId() {
  const { data: session, status: sessionStatus } = useSession();
  const [profileId, setProfileIdState] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', []);
  const api = useMemo(() => createClient({ baseUrl: `${apiBase}/v1` }), [apiBase]);

  const setProfileId = useCallback((id: string) => {
    setProfileIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY_PROFILE_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEY_PROFILE_ID);
    }
  }, []);

  useEffect(() => {
    // Wait for session to be determined
    if (sessionStatus === 'loading') return;

    (async () => {
      try {
        // 1. If authenticated, prefer session profiles
        if (session?.user?.profiles && session.user.profiles.length > 0) {
          const stored = localStorage.getItem(STORAGE_KEY_PROFILE_ID);
          // Use stored profile if it belongs to this user, otherwise use first profile
          const matchingProfile = session.user.profiles.find((p) => p.id === stored);
          const selectedProfile = matchingProfile || session.user.profiles[0];
          if (selectedProfile) {
            setProfileIdState(selectedProfile.id);
            localStorage.setItem(STORAGE_KEY_PROFILE_ID, selectedProfile.id);
            setLoading(false);
            return;
          }
        }

        // 2. Check localStorage (for unauthenticated users)
        const stored = localStorage.getItem(STORAGE_KEY_PROFILE_ID);
        if (stored) {
          setProfileIdState(stored);
          setLoading(false);
          return;
        }

        // 3. Fall back to env var
        const envId = process.env.NEXT_PUBLIC_DEFAULT_PROFILE_ID;
        if (envId) {
          setProfileIdState(envId);
          localStorage.setItem(STORAGE_KEY_PROFILE_ID, envId);
          setLoading(false);
          return;
        }

        // 4. Fall back to API /profiles (for unauthenticated users)
        if (!session) {
          const json = await api.get<{ items: { id: string }[] }>('/profiles');
          const first = Array.isArray(json.items) ? json.items[0] : undefined;
          if (first) {
            setProfileIdState(first.id);
            localStorage.setItem(STORAGE_KEY_PROFILE_ID, first.id);
          } else {
            setError('No profile found');
          }
        }
      } catch {
        const envId = process.env.NEXT_PUBLIC_DEFAULT_PROFILE_ID;
        if (envId) {
          setProfileIdState(envId);
        } else {
          setError('Failed to discover profile');
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, sessionStatus]);

  return { profileId, setProfileId, loading, error, apiBase, api };
}
