/**
 * AI/MCP Feature Configuration
 * Epic 8: AI & Social - Feature Flags, Cost Controls, Provider Selection
 *
 * Reference: docs/adr/0002-mcp-agentic-architecture.md
 */

import type { AIFeatureFlags } from './types';

// ============================================================================
// Feature Flags
// ============================================================================

export function getFeatureFlags(): AIFeatureFlags {
  return {
    AI_CONCIERGE_ENABLED: envBool('AI_CONCIERGE_ENABLED', false),
    NLU_ENABLED: envBool('NLU_ENABLED', true),
    SOCIAL_FEED_ENABLED: envBool('SOCIAL_FEED_ENABLED', false),
    PLAN_ENFORCEMENT_ENABLED: envBool('PLAN_ENFORCEMENT_ENABLED', false),
    AFFILIATES_ENABLED: envBool('AFFILIATES_ENABLED', false),
    REFERRAL_ENABLED: envBool('REFERRAL_ENABLED', false),
  };
}

export function isAIConciergeEnabled(): boolean {
  return getFeatureFlags().AI_CONCIERGE_ENABLED;
}

export function isNLUEnabled(): boolean {
  return getFeatureFlags().NLU_ENABLED;
}

export function isSocialFeedEnabled(): boolean {
  return getFeatureFlags().SOCIAL_FEED_ENABLED;
}

// ============================================================================
// Plan Configuration (Epic 9)
// ============================================================================

export interface PlanConfig {
  planEnforcementEnabled: boolean;
  trialDurationDays: number;
  freeListLimit: number;
  premiumFeatures: string[];
}

export function getPlanConfig(): PlanConfig {
  return {
    planEnforcementEnabled: envBool('PLAN_ENFORCEMENT_ENABLED', false),
    trialDurationDays: envInt('PREMIUM_TRIAL_DAYS', 14),
    freeListLimit: envInt('FREE_LIST_LIMIT', 5),
    premiumFeatures: ['advanced_filters', 'early_alerts', 'ad_free', 'social_analytics'],
  };
}

export function isPlanEnforcementEnabled(): boolean {
  return getPlanConfig().planEnforcementEnabled;
}

// ============================================================================
// LLM Provider Configuration
// ============================================================================

export type LLMProvider = 'anthropic' | 'openai' | 'none';

export interface LLMProviderConfig {
  provider: LLMProvider;
  apiKey?: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export function getLLMProviderConfig(): LLMProviderConfig {
  const provider = (process.env.LLM_PROVIDER || 'none') as LLMProvider;

  switch (provider) {
    case 'anthropic': {
      const result: LLMProviderConfig = {
        provider: 'anthropic',
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        maxTokens: envInt('LLM_MAX_TOKENS', 1024),
        temperature: envFloat('LLM_TEMPERATURE', 0.7),
      };
      if (process.env.ANTHROPIC_API_KEY) result.apiKey = process.env.ANTHROPIC_API_KEY;
      return result;
    }
    case 'openai': {
      const result: LLMProviderConfig = {
        provider: 'openai',
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        maxTokens: envInt('LLM_MAX_TOKENS', 1024),
        temperature: envFloat('LLM_TEMPERATURE', 0.7),
      };
      if (process.env.OPENAI_API_KEY) result.apiKey = process.env.OPENAI_API_KEY;
      return result;
    }
    default:
      return {
        provider: 'none',
        model: 'none',
        maxTokens: 0,
        temperature: 0,
      };
  }
}

export function hasValidLLMProvider(): boolean {
  const config = getLLMProviderConfig();
  return config.provider !== 'none' && Boolean(config.apiKey);
}

// ============================================================================
// Cost Controls (Epic 8, Epic 12)
// ============================================================================

export interface CostControlConfig {
  dailyLimitFree: number;
  dailyLimitPremium: number;
  monthlyBudgetUSD: number;
  perRequestMaxTokens: number;
}

export function getCostControlConfig(): CostControlConfig {
  return {
    dailyLimitFree: envInt('LLM_DAILY_LIMIT_FREE', 10),
    dailyLimitPremium: envInt('LLM_DAILY_LIMIT_PREMIUM', 1000),
    monthlyBudgetUSD: envFloat('LLM_MONTHLY_BUDGET_USD', 500),
    perRequestMaxTokens: envInt('LLM_PER_REQUEST_MAX_TOKENS', 2048),
  };
}

// ============================================================================
// Safety Configuration (Epic 8)
// ============================================================================

export interface SafetyConfig {
  promptRedactionEnabled: boolean;
  safetyFilterEnabled: boolean;
  blockedPatterns: RegExp[];
}

export function getSafetyConfig(): SafetyConfig {
  return {
    promptRedactionEnabled: envBool('CHAT_PROMPT_REDACTION', true),
    safetyFilterEnabled: envBool('CHAT_SAFETY_FILTER', true),
    blockedPatterns: [
      // Prompt injection patterns
      /ignore\s+(previous|all)\s+instructions/i,
      /you\s+are\s+now\s+(a|an)/i,
      /system\s*:\s*/i,
      /\[INST\]/i,
      /<\|im_start\|>/i,
      // Jailbreak attempts
      /pretend\s+you('re|\s+are)\s+not/i,
      /bypass\s+(your|the)\s+(rules|restrictions)/i,
      /act\s+as\s+if\s+you\s+have\s+no\s+restrictions/i,
    ],
  };
}

// ============================================================================
// MCP Configuration
// ============================================================================

export interface MCPConfig {
  enabled: boolean;
  tmdbEnabled: boolean;
  justwatchEnabled: boolean;
  lazyLoadEnabled: boolean;
  cacheSeconds: number;
  maxRetries: number;
  backoffMs: number;
}

export function getMCPConfig(): MCPConfig {
  return {
    enabled: envBool('MCP_ENABLED', true),
    tmdbEnabled: envBool('MCP_TMDB_ENABLED', true),
    justwatchEnabled: envBool('MCP_JUSTWATCH_ENABLED', true),
    lazyLoadEnabled: envBool('MCP_LAZY_LOAD', true),
    cacheSeconds: envInt('MCP_CACHE_SECONDS', 300),
    maxRetries: envInt('MCP_MAX_RETRIES', 3),
    backoffMs: envInt('MCP_BACKOFF_MS', 1000),
  };
}

// ============================================================================
// Rate Limiting (Epic 8, Epic 9)
// ============================================================================

export interface RateLimitConfig {
  windowMs: number;
  maxRequestsFree: number;
  maxRequestsPremium: number;
}

export function getRateLimitConfig(): RateLimitConfig {
  return {
    windowMs: envInt('CHAT_RATE_LIMIT_WINDOW_MS', 60_000), // 1 minute
    maxRequestsFree: envInt('CHAT_RATE_LIMIT_FREE', 5),
    maxRequestsPremium: envInt('CHAT_RATE_LIMIT_PREMIUM', 30),
  };
}

// ============================================================================
// Session Configuration
// ============================================================================

export interface SessionConfig {
  maxTurns: number;
  ttlSeconds: number;
  maxHistoryTokens: number;
}

export function getSessionConfig(): SessionConfig {
  return {
    maxTurns: envInt('CHAT_MAX_TURNS', 20),
    ttlSeconds: envInt('CHAT_SESSION_TTL_SECONDS', 1800), // 30 minutes
    maxHistoryTokens: envInt('CHAT_MAX_HISTORY_TOKENS', 4000),
  };
}

// ============================================================================
// Availability Source (Epic 1 compatibility)
// ============================================================================

export type AvailabilitySource = 'TMDB' | 'JUSTWATCH' | 'WATCHMODE' | 'LOCAL';

export function getAvailabilitySource(): AvailabilitySource {
  return (process.env.AVAILABILITY_SOURCE || 'LOCAL') as AvailabilitySource;
}

export function shouldUseMCPForAvailability(): boolean {
  const source = getAvailabilitySource();
  return source === 'JUSTWATCH' || source === 'WATCHMODE';
}

// ============================================================================
// Utilities
// ============================================================================

function envBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

function envInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function envFloat(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}
