'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
    : 'http://localhost:4000';

export interface NluEntities {
  genres?: string[];
  services?: string[];
  moods?: string[];
  titles?: string[];
  duration?: { min?: number; max?: number };
  releaseYear?: { min?: number; max?: number };
  region?: string;
}

export interface NluParseState {
  entities: NluEntities | null;
  cleanQuery: string | null;
  isParsed: boolean;
  isLoading: boolean;
}

/**
 * Hook that calls the NLU parse endpoint to extract structured entities
 * from a natural-language search query.
 *
 * Only fires when the query has 2+ words (heuristic for conversational queries).
 * Debounced at 300ms to avoid rapid API calls during typing.
 */
export function useNluParse(query: string): NluParseState {
  const [entities, setEntities] = useState<NluEntities | null>(null);
  const [cleanQuery, setCleanQuery] = useState<string | null>(null);
  const [isParsed, setIsParsed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const lastQueryRef = useRef<string>('');
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setEntities(null);
    setCleanQuery(null);
    setIsParsed(false);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

    // Only parse queries with 2+ words
    if (wordCount < 2) {
      if (isParsed || isLoading) reset();
      return;
    }

    // Skip if same query already parsed
    if (trimmed === lastQueryRef.current && isParsed) return;

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);

      const url = `${API_BASE}/v1/nlu/parse?q=${encodeURIComponent(trimmed)}`;

      fetch(url, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) {
            reset();
            return;
          }
          const body = (await res.json()) as {
            originalQuery?: string;
            cleanQuery?: string;
            entities?: NluEntities;
          };

          // Only update if entities were actually extracted
          const ent = body.entities;
          const hasEntities =
            ent &&
            ((ent.genres && ent.genres.length > 0) ||
              (ent.services && ent.services.length > 0) ||
              (ent.moods && ent.moods.length > 0) ||
              ent.duration ||
              ent.releaseYear ||
              ent.region ||
              (ent.titles && ent.titles.length > 0));

          if (hasEntities) {
            setEntities(ent ?? null);
            setCleanQuery(body.cleanQuery ?? null);
            setIsParsed(true);
            lastQueryRef.current = trimmed;
          } else {
            reset();
            lastQueryRef.current = trimmed;
          }
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          reset();
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { entities, cleanQuery, isParsed, isLoading };
}
