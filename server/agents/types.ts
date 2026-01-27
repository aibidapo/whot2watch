/**
 * MCP Agent Architecture - Type Definitions
 * Epic 8: AI & Social (AI Concierge)
 *
 * Reference: docs/adr/0002-mcp-agentic-architecture.md
 */

import type { PrismaClient } from '@prisma/client';

// ============================================================================
// Intent Classification
// ============================================================================

export type UserIntent =
  | 'search' // Natural language search query
  | 'availability' // Where can I watch X?
  | 'recommendations' // What should I watch?
  | 'preferences' // Update my taste preferences
  | 'social' // Friends' activity / picks
  | 'unknown'; // Fallback to search

export interface IntentClassification {
  intent: UserIntent;
  confidence: number;
  entities: ExtractedEntities;
  rawQuery: string;
}

export interface ExtractedEntities {
  titles?: string[];
  genres?: string[];
  moods?: string[];
  services?: string[];
  duration?: { min?: number; max?: number };
  releaseYear?: { min?: number; max?: number };
  cast?: string[];
  region?: string;
}

// ============================================================================
// Worker Agents
// ============================================================================

export type WorkerType = 'search' | 'availability' | 'preferences' | 'recommendations';

export interface WorkerContext {
  profileId?: string;
  region?: string;
  subscriptions?: string[];
  conversationId: string;
  turnNumber: number;
}

export interface WorkerInput {
  intent: IntentClassification;
  context: WorkerContext;
  previousResults?: WorkerResult[];
}

export interface WorkerResult {
  worker: WorkerType;
  success: boolean;
  data?: unknown;
  error?: string;
  latencyMs: number;
  tokenUsage?: TokenUsage;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

// ============================================================================
// Title Data (matches Prisma model)
// ============================================================================

export interface TitleResult {
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

export interface AvailabilityResult {
  titleId: string;
  service: string;
  region: string;
  offerType: 'flatrate' | 'rent' | 'buy' | 'free' | 'ads';
  deepLink?: string;
}

export interface RecommendationResult {
  title: TitleResult;
  score: number;
  reason: string;
  availability?: AvailabilityResult[];
  matchedPreferences?: string[];
}

// ============================================================================
// Orchestrator
// ============================================================================

export interface OrchestratorInput {
  message: string;
  sessionId?: string;
  profileId?: string;
  context?: ConversationContext;
}

export interface OrchestratorOutput {
  sessionId: string;
  recommendations: RecommendationResult[];
  reasoning: string;
  alternatives?: TitleResult[];
  followUpQuestions?: string[];
  fallbackUsed: boolean;
  workerResults: WorkerResult[];
}

// ============================================================================
// Conversation Context
// ============================================================================

export interface ConversationContext {
  sessionId: string;
  profileId?: string;
  region?: string;
  subscriptions: string[];
  history: ConversationTurn[];
  preferences: UserPreferences;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface ConversationTurn {
  turnNumber: number;
  userMessage: string;
  intent: IntentClassification;
  assistantResponse: string;
  recommendations: string[]; // Title IDs
  timestamp: Date;
}

export interface UserPreferences {
  genres: string[];
  moods: string[];
  avoidGenres: string[];
  minRating?: number;
  preferredDuration?: { min?: number; max?: number };
}

// ============================================================================
// MCP Types
// ============================================================================

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  lazyLoad?: boolean;
}

// ============================================================================
// Chat API Types
// ============================================================================

export interface ChatRequest {
  sessionId?: string;
  message: string;
  profileId?: string;
  context?: Partial<ConversationContext>;
}

export interface ChatQuota {
  remaining: number;
  limit: number;
  resetsAt: string;
  tier: 'free' | 'premium';
}

export interface ChatResponse {
  sessionId: string;
  recommendations: RecommendationResult[];
  reasoning: string;
  alternatives?: TitleResult[];
  followUpQuestions?: string[];
  quota?: ChatQuota;
}

export interface ChatStreamEvent {
  type: 'message' | 'recommendation' | 'done' | 'error';
  data: unknown;
}

// ============================================================================
// Feature Flags
// ============================================================================

export interface AIFeatureFlags {
  AI_CONCIERGE_ENABLED: boolean;
  NLU_ENABLED: boolean;
  SOCIAL_FEED_ENABLED: boolean;
  PLAN_ENFORCEMENT_ENABLED: boolean;
  AFFILIATES_ENABLED: boolean;
  REFERRAL_ENABLED: boolean;
}

// ============================================================================
// Analytics Events (Epic 5)
// ============================================================================

export interface AIAnalyticsEvent {
  eventType:
    | 'chat_message_sent'
    | 'chat_response_received'
    | 'chat_fallback_triggered'
    | 'llm_request_count'
    | 'llm_tokens_used'
    | 'llm_cost_estimate';
  sessionId: string;
  profileId?: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Safety & Cost Controls (Epic 8)
// ============================================================================

export interface SafetyCheckResult {
  safe: boolean;
  reason?: string;
  blockedPatterns?: string[];
}

export interface RateLimitStatus {
  remaining: number;
  limit: number;
  resetAt: Date;
  tier: 'free' | 'premium';
}

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUSD: number;
}

// ============================================================================
// Service Dependencies
// ============================================================================

export interface AgentDependencies {
  prisma: PrismaClient;
  redis?: RedisLike;
  opensearch?: OpenSearchLike;
}

// Minimal interfaces for external services (avoid tight coupling)
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<unknown>;
  del(key: string): Promise<number>;
}

export interface OpenSearchLike {
  search(params: { index: string; body: unknown }): Promise<{ body: unknown }>;
}
