/**
 * Chat Session Management
 * Epic 8: AI & Social — Session lifecycle for chat conversations
 *
 * Wraps ConversationContextManager with chat-specific operations
 * including session validation and rate-limit–aware session tracking.
 */

import type {
  ConversationContext,
  RedisLike,
} from "../agents/types";
import {
  getContextManager,
  type ConversationContextManager,
} from "../agents/context";
import {
  getCostControlConfig,
  getRateLimitConfig,
  getSessionConfig,
} from "../agents/config";
import { createLogger } from "../common/logger";

const logger = createLogger("chat-session");

// ============================================================================
// Chat Session
// ============================================================================

export interface ChatSession {
  sessionId: string;
  context: ConversationContext;
  messageCount: number;
  isNew: boolean;
}

export interface ChatSessionManagerOptions {
  redis?: RedisLike;
}

export interface DailyQuotaResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetsAt: string; // ISO-8601 midnight UTC
}

export class ChatSessionManager {
  private contextManager: ConversationContextManager;
  private redis?: RedisLike;
  private sessionConfig = getSessionConfig();
  private rateLimitConfig = getRateLimitConfig();
  private costConfig = getCostControlConfig();

  constructor(options: ChatSessionManagerOptions = {}) {
    if (options.redis) this.redis = options.redis;
    this.contextManager = getContextManager(options.redis);
  }

  /**
   * Get or create a chat session. Returns session info including
   * whether it's newly created and current message count.
   */
  async getOrCreateSession(
    sessionId?: string,
    profileId?: string,
    region?: string,
    subscriptions?: string[]
  ): Promise<ChatSession> {
    const context = await this.contextManager.getOrCreate(
      sessionId,
      profileId,
      region,
      subscriptions
    );

    const isNew = context.history.length === 0 && !sessionId;

    return {
      sessionId: context.sessionId,
      context,
      messageCount: context.history.length,
      isNew,
    };
  }

  /**
   * Get an existing session by ID. Returns null if not found or expired.
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    const context = await this.contextManager.getOrCreate(sessionId);
    if (!context) return null;

    return {
      sessionId: context.sessionId,
      context,
      messageCount: context.history.length,
      isNew: false,
    };
  }

  /**
   * End a chat session and clean up resources.
   */
  async endSession(sessionId: string): Promise<void> {
    await this.contextManager.endSession(sessionId);
    logger.info("Chat session ended", { sessionId });
  }

  /**
   * Check if a session has exceeded the max turn limit.
   */
  isSessionExhausted(session: ChatSession): boolean {
    return session.messageCount >= this.sessionConfig.maxTurns;
  }

  /**
   * Check per-user rate limit using Redis.
   * Returns remaining message count, or -1 if rate limiting is unavailable.
   */
  async checkRateLimit(
    profileId: string,
    tier: "free" | "premium" = "free"
  ): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    if (!this.redis) {
      // No Redis = no rate limiting; allow all
      return { allowed: true, remaining: -1, limit: -1 };
    }

    const limit =
      tier === "premium"
        ? this.rateLimitConfig.maxRequestsPremium
        : this.rateLimitConfig.maxRequestsFree;

    const key = `chat:ratelimit:${profileId}`;

    try {
      const currentStr = await this.redis.get(key);
      const current = currentStr ? parseInt(currentStr, 10) : 0;

      if (current >= limit) {
        return { allowed: false, remaining: 0, limit };
      }

      // Increment counter
      const next = current + 1;
      const windowSeconds = Math.ceil(
        this.rateLimitConfig.windowMs / 1000
      );
      await this.redis.set(key, String(next), {
        EX: windowSeconds,
      });

      return { allowed: true, remaining: limit - next, limit };
    } catch (error) {
      logger.warn("Rate limit check failed, allowing request", {
        profileId,
        error: String(error),
      });
      return { allowed: true, remaining: -1, limit };
    }
  }

  /**
   * Check daily message quota using Redis.
   * Key: chat:dailyquota:{profileId}:{YYYY-MM-DD} with TTL until midnight UTC.
   * Fails open (allows) if Redis is unavailable.
   */
  async checkDailyQuota(
    profileId: string,
    tier: "free" | "premium" = "free"
  ): Promise<DailyQuotaResult> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const tomorrow = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    );
    const resetsAt = tomorrow.toISOString();
    const ttlSeconds = Math.ceil((tomorrow.getTime() - now.getTime()) / 1000);

    const limit =
      tier === "premium"
        ? this.costConfig.dailyLimitPremium
        : this.costConfig.dailyLimitFree;

    if (!this.redis) {
      return { allowed: true, remaining: -1, limit, resetsAt };
    }

    const key = `chat:dailyquota:${profileId}:${dateStr}`;

    try {
      const currentStr = await this.redis.get(key);
      const current = currentStr ? parseInt(currentStr, 10) : 0;

      if (current >= limit) {
        return { allowed: false, remaining: 0, limit, resetsAt };
      }

      const next = current + 1;
      await this.redis.set(key, String(next), { EX: ttlSeconds });

      return { allowed: true, remaining: limit - next, limit, resetsAt };
    } catch (error) {
      logger.warn("Daily quota check failed, allowing request", {
        profileId,
        error: String(error),
      });
      return { allowed: true, remaining: -1, limit, resetsAt };
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let sessionManagerInstance: ChatSessionManager | null = null;

export function getChatSessionManager(
  options?: ChatSessionManagerOptions
): ChatSessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new ChatSessionManager(options);
  }
  return sessionManagerInstance;
}

export function resetChatSessionManager(): void {
  sessionManagerInstance = null;
}
