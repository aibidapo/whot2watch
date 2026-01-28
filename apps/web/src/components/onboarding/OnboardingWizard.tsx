'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import createClient from 'clients/rest/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import {
  GENRE_OPTIONS,
  MOOD_OPTIONS,
  STREAMING_SERVICES,
  STORAGE_KEY_PROFILE_ID,
} from '@/constants/onboarding';

type Step = 'taste' | 'services' | 'summary';

const STEPS: Step[] = ['taste', 'services', 'summary'];

function formatService(s: string): string {
  return s
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function toggleSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function OnboardingWizard({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('taste');
  const [genres, setGenres] = useState<Set<string>>(new Set());
  const [moods, setMoods] = useState<Set<string>>(new Set());
  const [services, setServices] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', []);
  const api = useMemo(() => createClient({ baseUrl: `${apiBase}/v1` }), [apiBase]);

  const stepIndex = STEPS.indexOf(step);

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await api.put(`/profiles/${profileId}/preferences`, {
        genres: [...genres],
        moods: [...moods],
        avoidGenres: [],
        minRating: null,
      });

      const defaultRegion = process.env.NEXT_PUBLIC_DEFAULT_REGIONS?.split(',')[0] || 'US';
      for (const svc of services) {
        await api.post(`/profiles/${profileId}/subscriptions`, {
          service: svc,
          region: defaultRegion,
        });
      }

      await api.patch(`/profiles/${profileId}/onboarding-complete`, {});

      localStorage.setItem(STORAGE_KEY_PROFILE_ID, profileId);
      router.push('/picks');
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err && 'message' in err
          ? String((err as Error).message)
          : 'Failed to save preferences';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto grid gap-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                i <= stepIndex
                  ? 'bg-brand-cyan text-accent'
                  : 'bg-border text-muted'
              }`}
            >
              {i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-12 h-0.5 transition-colors ${
                  i < stepIndex ? 'bg-brand-cyan' : 'bg-border'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Taste */}
      {step === 'taste' && (
        <Card className="animate-fade-in-up">
          <h2 className="text-2xl font-bold mb-1">What do you like?</h2>
          <p className="text-muted mb-4">Pick genres and moods that match your taste.</p>

          <h3 className="text-sm font-medium text-muted uppercase tracking-wide mb-2">Genres</h3>
          <div className="flex flex-wrap gap-2 mb-6">
            {GENRE_OPTIONS.map((g) => (
              <Chip
                key={g}
                selected={genres.has(g)}
                onClick={() => setGenres(toggleSet(genres, g))}
              >
                {g}
              </Chip>
            ))}
          </div>

          <h3 className="text-sm font-medium text-muted uppercase tracking-wide mb-2">Moods</h3>
          <div className="flex flex-wrap gap-2 mb-6">
            {MOOD_OPTIONS.map((m) => (
              <Chip
                key={m}
                selected={moods.has(m)}
                onClick={() => setMoods(toggleSet(moods, m))}
              >
                {m}
              </Chip>
            ))}
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setStep('services')} disabled={genres.size === 0}>
              Next
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Services */}
      {step === 'services' && (
        <Card className="animate-fade-in-up">
          <h2 className="text-2xl font-bold mb-1">Your streaming services</h2>
          <p className="text-muted mb-4">Select the services you subscribe to.</p>

          <div className="flex flex-wrap gap-2 mb-6">
            {STREAMING_SERVICES.map((s) => (
              <Chip
                key={s}
                selected={services.has(s)}
                onClick={() => setServices(toggleSet(services, s))}
              >
                {formatService(s)}
              </Chip>
            ))}
          </div>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep('taste')}>
              Back
            </Button>
            <Button onClick={() => setStep('summary')}>
              {services.size > 0 ? 'Next' : 'Skip'}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Summary */}
      {step === 'summary' && (
        <Card className="animate-fade-in-up">
          <h2 className="text-2xl font-bold mb-4">Looking good!</h2>

          {genres.size > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-muted uppercase tracking-wide mb-2">
                Genres
              </h3>
              <div className="flex flex-wrap gap-2">
                {[...genres].map((g) => (
                  <Chip key={g} selected>
                    {g}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {moods.size > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-muted uppercase tracking-wide mb-2">
                Moods
              </h3>
              <div className="flex flex-wrap gap-2">
                {[...moods].map((m) => (
                  <Chip key={m} selected>
                    {m}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {services.size > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-muted uppercase tracking-wide mb-2">
                Services
              </h3>
              <div className="flex flex-wrap gap-2">
                {[...services].map((s) => (
                  <Chip key={s} selected>
                    {formatService(s)}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {error && <div className="text-error-text text-sm mb-4">{error}</div>}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep('services')}>
              Back
            </Button>
            <Button onClick={finish} disabled={saving}>
              {saving ? 'Saving...' : 'Get my picks'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
