/**
 * Frontend chat type definitions for AI Concierge.
 * Mirrors backend types from server/agents/types.ts without importing them.
 */

// -- API response types --

export interface ChatTitleResult {
  id: string;
  tmdbId?: number;
  imdbId?: string;
  type: 'movie' | 'tv';
  name: string;
  releaseYear?: number;
  runtimeMin?: number;
  genres: string[];
  moods: string[];
  voteAverage?: number;
  popularity?: number;
  posterUrl?: string;
  backdropUrl?: string;
}

export interface ChatAvailabilityResult {
  titleId: string;
  service: string;
  region: string;
  offerType: 'flatrate' | 'rent' | 'buy' | 'free' | 'ads';
  deepLink?: string;
}

export interface ChatRecommendation {
  title: ChatTitleResult;
  score: number;
  reason: string;
  availability?: ChatAvailabilityResult[];
  matchedPreferences?: string[];
}

// -- SSE stream types --

export interface ChatStreamEvent {
  type: 'message' | 'recommendation' | 'done' | 'error';
  data: unknown;
}

export interface ChatQuota {
  remaining: number;
  limit: number;
  resetsAt: string;
  tier: 'free' | 'premium';
}

export interface ChatDoneData {
  sessionId: string;
  reasoning: string;
  followUpQuestions?: string[];
  totalRecommendations: number;
  fallbackUsed: boolean;
  quota?: ChatQuota;
}

// -- Internal UI types --

export type MessageRole = 'user' | 'assistant';

export interface ChatMessageData {
  id: string;
  role: MessageRole;
  text: string;
  recommendations: ChatRecommendation[];
  followUpQuestions: string[];
  timestamp: number;
}

export interface ChatError {
  code: string;
  message: string;
}

export interface UseChatReturn {
  messages: ChatMessageData[];
  isOpen: boolean;
  isLoading: boolean;
  isEnabled: boolean | null;
  error: ChatError | null;
  sessionId: string | null;
  quota: ChatQuota | null;
  send: (message: string) => void;
  toggle: () => void;
  close: () => void;
  clearError: () => void;
  endSession: () => void;
}
