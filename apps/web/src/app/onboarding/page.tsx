'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import createClient from 'clients/rest/client';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { STORAGE_KEY_PROFILE_ID } from '@/constants/onboarding';

export default function OnboardingPage() {
  const router = useRouter();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', []);
  const api = useMemo(() => createClient({ baseUrl: `${apiBase}/v1` }), [apiBase]);

  useEffect(() => {
    (async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_PROFILE_ID);
        if (stored) {
          const prefs = await api.get<{ onboardingComplete: boolean }>(
            `/profiles/${stored}/preferences`,
          );
          if (prefs.onboardingComplete) {
            router.replace('/picks');
            return;
          }
          setProfileId(stored);
          setLoading(false);
          return;
        }

        const envId = process.env.NEXT_PUBLIC_DEFAULT_PROFILE_ID;
        if (envId) {
          setProfileId(envId);
          setLoading(false);
          return;
        }

        const json = await api.get<{ items: { id: string }[] }>('/profiles');
        const first = Array.isArray(json.items) ? json.items[0] : undefined;
        if (first) {
          setProfileId(first.id);
        }
      } catch {
        const envId = process.env.NEXT_PUBLIC_DEFAULT_PROFILE_ID;
        if (envId) setProfileId(envId);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-muted">Loading...</div>
      </div>
    );
  }

  if (!profileId) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-muted">No profile found. Please create one first.</div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 py-8">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
          Welcome to <span className="brand-text">Whot2Watch</span>
        </h1>
        <p className="text-muted text-lg">Let&apos;s personalize your experience.</p>
      </div>
      <OnboardingWizard profileId={profileId} />
    </div>
  );
}
