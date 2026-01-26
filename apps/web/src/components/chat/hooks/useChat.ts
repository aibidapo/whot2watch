'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type {
  ChatMessageData,
  ChatRecommendation,
  ChatDoneData,
  ChatStreamEvent,
  ChatError,
  UseChatReturn,
} from '../types';

const API_BASE =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
    : 'http://localhost:4000';

const PROFILE_ID = process.env.NEXT_PUBLIC_DEFAULT_PROFILE_ID || '';

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<ChatError | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingIdRef = useRef<string | null>(null);

  // Health check on mount
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/v1/chat/health`)
      .then((r) => r.json())
      .then((body: { enabled?: boolean }) => {
        if (!cancelled) setIsEnabled(body.enabled === true);
      })
      .catch(() => {
        if (!cancelled) setIsEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cleanup abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const send = useCallback(
    (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || isLoading) return;

      // Abort any in-flight request
      abortRef.current?.abort();

      // Append user message
      const userMsg: ChatMessageData = {
        id: uid(),
        role: 'user',
        text: trimmed,
        recommendations: [],
        followUpQuestions: [],
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);

      // Create a pending assistant message ID
      const assistantId = uid();
      pendingIdRef.current = assistantId;

      // Append empty assistant message (will be filled progressively)
      const assistantMsg: ChatMessageData = {
        id: assistantId,
        role: 'assistant',
        text: '',
        recommendations: [],
        followUpQuestions: [],
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const controller = new AbortController();
      abortRef.current = controller;

      const params = new URLSearchParams({ message: trimmed });
      if (sessionId) params.set('session', sessionId);
      if (PROFILE_ID) params.set('profileId', PROFILE_ID);

      const url = `${API_BASE}/v1/chat/stream?${params.toString()}`;

      fetch(url, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) {
            let errBody: { error?: string; code?: string } = {};
            try {
              errBody = await res.json();
            } catch {
              /* ignore parse failure */
            }
            const code =
              res.status === 503
                ? 'CONCIERGE_DISABLED'
                : res.status === 429
                  ? 'RATE_LIMIT_EXCEEDED'
                  : res.status === 400
                    ? 'INVALID_REQUEST'
                    : 'NETWORK_ERROR';
            const msg =
              errBody.error ||
              (res.status === 503
                ? 'AI Concierge is currently unavailable'
                : res.status === 429
                  ? 'Rate limit exceeded. Please try again later.'
                  : `Request failed (${res.status})`);
            setError({ code, message: msg });
            // Remove the empty assistant message
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
            setIsLoading(false);
            return;
          }

          if (!res.body) {
            setError({ code: 'NETWORK_ERROR', message: 'No response body' });
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
            setIsLoading(false);
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          const recs: ChatRecommendation[] = [];

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });

              const chunks = buffer.split('\n\n');
              buffer = chunks.pop() || '';

              for (const chunk of chunks) {
                const line = chunk.trim();
                if (!line.startsWith('data: ')) continue;
                let event: ChatStreamEvent;
                try {
                  event = JSON.parse(line.slice(6)) as ChatStreamEvent;
                } catch {
                  continue;
                }

                switch (event.type) {
                  case 'recommendation': {
                    const rec = event.data as ChatRecommendation;
                    recs.push(rec);
                    const recsCopy = [...recs];
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? { ...m, recommendations: recsCopy }
                          : m
                      )
                    );
                    break;
                  }
                  case 'done': {
                    const doneData = event.data as ChatDoneData;
                    setSessionId(doneData.sessionId);
                    const finalRecs = [...recs];
                    const followUps = doneData.followUpQuestions || [];
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? {
                              ...m,
                              text: doneData.reasoning,
                              recommendations: finalRecs,
                              followUpQuestions: followUps,
                            }
                          : m
                      )
                    );
                    break;
                  }
                  case 'error': {
                    const errData = event.data as { error?: string };
                    setError({
                      code: 'STREAM_ERROR',
                      message: errData.error || 'Stream error',
                    });
                    break;
                  }
                  // 'message' type is just a status indicator, no action needed
                }
              }
            }
          } finally {
            setIsLoading(false);
            pendingIdRef.current = null;
          }
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') {
            // User cancelled — remove pending assistant message
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          } else {
            setError({
              code: 'NETWORK_ERROR',
              message: 'Connection failed. Check your internet and try again.',
            });
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          }
          setIsLoading(false);
          pendingIdRef.current = null;
        });
    },
    [isLoading, sessionId]
  );

  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const close = useCallback(() => setIsOpen(false), []);
  const clearError = useCallback(() => setError(null), []);

  const endSession = useCallback(() => {
    if (sessionId) {
      fetch(`${API_BASE}/v1/chat/${sessionId}`, { method: 'DELETE' }).catch(
        () => {
          /* best effort */
        }
      );
    }
    abortRef.current?.abort();
    setSessionId(null);
    setMessages([]);
    setError(null);
    setIsLoading(false);
  }, [sessionId]);

  return useMemo(
    () => ({
      messages,
      isOpen,
      isLoading,
      isEnabled,
      error,
      sessionId,
      send,
      toggle,
      close,
      clearError,
      endSession,
    }),
    [
      messages,
      isOpen,
      isLoading,
      isEnabled,
      error,
      sessionId,
      send,
      toggle,
      close,
      clearError,
      endSession,
    ]
  );
}
