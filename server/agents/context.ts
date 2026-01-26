/**
 * Conversation Context Management
 * Epic 8: AI & Social - Session persistence with Redis
 *
 * Reference: docs/adr/0002-mcp-agentic-architecture.md
 */

import { randomUUID } from "crypto";
import type {
  ConversationContext,
  ConversationTurn,
  IntentClassification,
  RedisLike,
  UserPreferences,
} from "./types";
import { getSessionConfig } from "./config";
import { createLogger } from "../common/logger";

const logger = createLogger("conversation-context");

// ============================================================================
// Context Store Interface
// ============================================================================

export interface ContextStore {
  get(sessionId: string): Promise<ConversationContext | null>;
  set(context: ConversationContext): Promise<void>;
  delete(sessionId: string): Promise<void>;
  touch(sessionId: string): Promise<void>;
}

// ============================================================================
// Redis-backed Context Store
// ============================================================================

export class RedisContextStore implements ContextStore {
  private redis: RedisLike;
  private keyPrefix: string;
  private config = getSessionConfig();

  constructor(redis: RedisLike, keyPrefix = "chat:session:") {
    this.redis = redis;
    this.keyPrefix = keyPrefix;
  }

  async get(sessionId: string): Promise<ConversationContext | null> {
    try {
      const key = this.buildKey(sessionId);
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      const context = JSON.parse(data) as ConversationContext;

      // Convert date strings back to Date objects
      context.createdAt = new Date(context.createdAt);
      context.lastActiveAt = new Date(context.lastActiveAt);
      context.history = context.history.map((turn) => ({
        ...turn,
        timestamp: new Date(turn.timestamp),
      }));

      return context;
    } catch (error) {
      logger.error({ sessionId, error }, "Failed to get conversation context");
      return null;
    }
  }

  async set(context: ConversationContext): Promise<void> {
    try {
      const key = this.buildKey(context.sessionId);
      await this.redis.set(key, JSON.stringify(context), {
        EX: this.config.ttlSeconds,
      });
    } catch (error) {
      logger.error(
        { sessionId: context.sessionId, error },
        "Failed to set conversation context"
      );
    }
  }

  async delete(sessionId: string): Promise<void> {
    try {
      const key = this.buildKey(sessionId);
      await this.redis.del(key);
    } catch (error) {
      logger.error(
        { sessionId, error },
        "Failed to delete conversation context"
      );
    }
  }

  async touch(sessionId: string): Promise<void> {
    const context = await this.get(sessionId);
    if (context) {
      context.lastActiveAt = new Date();
      await this.set(context);
    }
  }

  private buildKey(sessionId: string): string {
    return `${this.keyPrefix}${sessionId}`;
  }
}

// ============================================================================
// In-Memory Context Store (fallback when Redis unavailable)
// ============================================================================

export class MemoryContextStore implements ContextStore {
  private store = new Map<string, ConversationContext>();
  private config = getSessionConfig();

  async get(sessionId: string): Promise<ConversationContext | null> {
    const context = this.store.get(sessionId);
    if (!context) return null;

    // Check TTL
    const now = Date.now();
    const expiresAt =
      context.lastActiveAt.getTime() + this.config.ttlSeconds * 1000;
    if (now > expiresAt) {
      this.store.delete(sessionId);
      return null;
    }

    return context;
  }

  async set(context: ConversationContext): Promise<void> {
    this.store.set(context.sessionId, context);
    this.cleanup(); // Periodic cleanup of expired sessions
  }

  async delete(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }

  async touch(sessionId: string): Promise<void> {
    const context = this.store.get(sessionId);
    if (context) {
      context.lastActiveAt = new Date();
    }
  }

  private cleanup(): void {
    // Only run cleanup occasionally to avoid performance impact
    if (Math.random() > 0.1) return;

    const now = Date.now();
    const expireThreshold = this.config.ttlSeconds * 1000;

    for (const [sessionId, context] of this.store.entries()) {
      if (now - context.lastActiveAt.getTime() > expireThreshold) {
        this.store.delete(sessionId);
      }
    }
  }

  getSize(): number {
    return this.store.size;
  }
}

// ============================================================================
// Context Manager
// ============================================================================

export class ConversationContextManager {
  private store: ContextStore;
  private config = getSessionConfig();

  constructor(store: ContextStore) {
    this.store = store;
  }

  async getOrCreate(
    sessionId?: string,
    profileId?: string,
    region?: string,
    subscriptions?: string[]
  ): Promise<ConversationContext> {
    if (sessionId) {
      const existing = await this.store.get(sessionId);
      if (existing) {
        return existing;
      }
    }

    // Create new session
    const newSessionId = sessionId || randomUUID();
    const context: ConversationContext = {
      sessionId: newSessionId,
      profileId,
      region,
      subscriptions: subscriptions || [],
      history: [],
      preferences: {
        genres: [],
        moods: [],
        avoidGenres: [],
      },
      createdAt: new Date(),
      lastActiveAt: new Date(),
    };

    await this.store.set(context);
    logger.info({ sessionId: newSessionId, profileId }, "Created new session");

    return context;
  }

  async addTurn(
    sessionId: string,
    userMessage: string,
    intent: IntentClassification,
    assistantResponse: string,
    recommendations: string[]
  ): Promise<ConversationContext | null> {
    const context = await this.store.get(sessionId);
    if (!context) {
      logger.warn({ sessionId }, "Session not found for addTurn");
      return null;
    }

    // Enforce max turns
    if (context.history.length >= this.config.maxTurns) {
      // Remove oldest turn(s) to make room
      const removeCount = Math.ceil(this.config.maxTurns * 0.2); // Remove 20%
      context.history = context.history.slice(removeCount);
      logger.info({ sessionId, removed: removeCount }, "Trimmed conversation history");
    }

    const turn: ConversationTurn = {
      turnNumber: context.history.length + 1,
      userMessage,
      intent,
      assistantResponse,
      recommendations,
      timestamp: new Date(),
    };

    context.history.push(turn);
    context.lastActiveAt = new Date();

    await this.store.set(context);
    return context;
  }

  async updatePreferences(
    sessionId: string,
    preferences: Partial<UserPreferences>
  ): Promise<ConversationContext | null> {
    const context = await this.store.get(sessionId);
    if (!context) {
      return null;
    }

    context.preferences = {
      ...context.preferences,
      ...preferences,
    };
    context.lastActiveAt = new Date();

    await this.store.set(context);
    return context;
  }

  async updateSubscriptions(
    sessionId: string,
    subscriptions: string[]
  ): Promise<ConversationContext | null> {
    const context = await this.store.get(sessionId);
    if (!context) {
      return null;
    }

    context.subscriptions = subscriptions;
    context.lastActiveAt = new Date();

    await this.store.set(context);
    return context;
  }

  async endSession(sessionId: string): Promise<void> {
    await this.store.delete(sessionId);
    logger.info({ sessionId }, "Session ended");
  }

  async getRecentHistory(
    sessionId: string,
    maxTurns = 5
  ): Promise<ConversationTurn[]> {
    const context = await this.store.get(sessionId);
    if (!context) {
      return [];
    }

    return context.history.slice(-maxTurns);
  }

  buildHistoryPrompt(context: ConversationContext): string {
    if (context.history.length === 0) {
      return "";
    }

    const recentTurns = context.history.slice(-5);
    const lines = recentTurns.map((turn) => {
      return `User: ${turn.userMessage}\nAssistant: ${turn.assistantResponse}`;
    });

    return `Previous conversation:\n${lines.join("\n\n")}`;
  }

  buildPreferencesPrompt(context: ConversationContext): string {
    const prefs = context.preferences;
    const parts: string[] = [];

    if (prefs.genres.length > 0) {
      parts.push(`Preferred genres: ${prefs.genres.join(", ")}`);
    }
    if (prefs.moods.length > 0) {
      parts.push(`Preferred moods: ${prefs.moods.join(", ")}`);
    }
    if (prefs.avoidGenres.length > 0) {
      parts.push(`Avoid genres: ${prefs.avoidGenres.join(", ")}`);
    }
    if (prefs.minRating) {
      parts.push(`Minimum rating: ${prefs.minRating}`);
    }
    if (prefs.preferredDuration) {
      const dur = prefs.preferredDuration;
      if (dur.min && dur.max) {
        parts.push(`Preferred duration: ${dur.min}-${dur.max} minutes`);
      } else if (dur.max) {
        parts.push(`Maximum duration: ${dur.max} minutes`);
      }
    }

    if (parts.length === 0) {
      return "";
    }

    return `User preferences:\n${parts.join("\n")}`;
  }

  buildSubscriptionsPrompt(context: ConversationContext): string {
    if (context.subscriptions.length === 0) {
      return "";
    }

    return `User subscriptions: ${context.subscriptions.join(", ")}`;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let contextManagerInstance: ConversationContextManager | null = null;

export function getContextManager(redis?: RedisLike): ConversationContextManager {
  if (!contextManagerInstance) {
    const store = redis
      ? new RedisContextStore(redis)
      : new MemoryContextStore();
    contextManagerInstance = new ConversationContextManager(store);
  }
  return contextManagerInstance;
}

export function resetContextManager(): void {
  contextManagerInstance = null;
}
