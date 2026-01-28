'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { useProfileId } from '@/hooks/useProfileId';

export default function OnboardingPage() {
  const router = useRouter();
  const { profileId, loading, error, api } = useProfileId();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading || !profileId || checked) return;
    (async () => {
      try {
        const prefs = await api.get<{ onboardingComplete: boolean }>(
          `/profiles/${profileId}/preferences`,
        );
        if (prefs.onboardingComplete) {
          router.replace('/picks');
          return;
        }
      } catch {
        // proceed to onboarding
      }
      setChecked(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profileId]);

  if (loading || (!checked && profileId)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-muted">Loading...</div>
      </div>
    );
  }

  if (error || !profileId) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-muted">{error || 'No profile found. Please create one first.'}</div>
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
