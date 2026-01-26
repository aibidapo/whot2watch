/**
 * Orchestrator Agent
 * Epic 8: AI & Social — Central orchestration for AI Concierge
 *
 * Classifies user intent, routes to specialist workers,
 * aggregates results, and generates follow-up questions.
 *
 * Reference: docs/adr/0002-mcp-agentic-architecture.md
 */

import type { PrismaClient } from "@prisma/client";
import type {
  OrchestratorInput,
  OrchestratorOutput,
  IntentClassification,
  UserIntent,
  ExtractedEntities,
  WorkerInput,
  WorkerResult,
  WorkerContext,
  RecommendationResult,
  TitleResult,
  RedisLike,
} from "./types";
import { isAIConciergeEnabled, hasValidLLMProvider } from "./config";
import { getContextManager } from "./context";
import { executeSearch, type SearchWorkerDeps } from "./workers/search.worker";
import { executeAvailability, type AvailabilityWorkerDeps } from "./workers/availability.worker";
import { executePreferences } from "./workers/preferences.worker";
import { executeRecommendations, type RecommendationsWorkerDeps } from "./workers/recommendations.worker";
import type { MCPClient } from "../mcp/client";
import { createLogger } from "../common/logger";

const logger = createLogger("orchestrator");

// ============================================================================
// Orchestrator Dependencies
// ============================================================================

export interface OrchestratorDeps {
  prisma: PrismaClient;
  redis?: RedisLike;
  mcpClient?: MCPClient;
}

// ============================================================================
// Main Orchestration
// ============================================================================

export async function orchestrate(
  input: OrchestratorInput,
  deps: OrchestratorDeps
): Promise<OrchestratorOutput> {
  const start = Date.now();

  // Feature flag check
  if (!isAIConciergeEnabled()) {
    logger.info("AI Concierge disabled, using NLU fallback");
    return orchestrateWithNLU(input, deps);
  }

  // LLM provider check — fallback to NLU if no valid provider
  if (!hasValidLLMProvider()) {
    logger.info("No valid LLM provider, using NLU fallback");
    return orchestrateWithNLU(input, deps);
  }

  // Full LLM orchestration would go here in the future
  // For now, always use NLU pipeline
  return orchestrateWithNLU(input, deps);
}

// ============================================================================
// NLU-Based Orchestration (Rules-Based Fallback)
// ============================================================================

async function orchestrateWithNLU(
  input: OrchestratorInput,
  deps: OrchestratorDeps
): Promise<OrchestratorOutput> {
  const start = Date.now();
  const contextManager = getContextManager(deps.redis);

  // Get or create session
  const context = input.context
    ? input.context
    : await contextManager.getOrCreate(
        input.sessionId,
        input.profileId
      );

  const sessionId = context.sessionId;

  // Step 1: Classify intent
  const intent = classifyIntent(input.message);
  logger.info("Intent classified", {
    sessionId,
    intent: intent.intent,
    confidence: intent.confidence,
  });

  // Step 2: Build worker context
  const workerContext: WorkerContext = {
    conversationId: sessionId,
    turnNumber: context.history.length + 1,
    subscriptions: context.subscriptions,
  };
  const pid = input.profileId || context.profileId;
  if (pid) workerContext.profileId = pid;
  if (context.region) workerContext.region = context.region;

  // Step 3: Route to workers based on intent
  const workerResults = await routeToWorkers(
    intent,
    workerContext,
    deps
  );

  // Step 4: Aggregate results
  const output = aggregateResults(
    sessionId,
    intent,
    workerResults
  );

  // Step 5: Record the turn in conversation history
  const recommendationIds = output.recommendations.map((r) => r.title.id);
  await contextManager.addTurn(
    sessionId,
    input.message,
    intent,
    output.reasoning,
    recommendationIds
  );

  logger.info("Orchestration complete", {
    sessionId,
    intent: intent.intent,
    recommendationCount: output.recommendations.length,
    latencyMs: Date.now() - start,
    fallbackUsed: output.fallbackUsed,
  });

  return output;
}

// ============================================================================
// Intent Classification (Rules-Based NLU)
// ============================================================================

const AVAILABILITY_PATTERNS = [
  /where\s+(can\s+)?i\s+watch/i,
  /available\s+on/i,
  /streaming\s+on/i,
  /is\s+.+\s+on\s+(netflix|hulu|disney|amazon|hbo|apple|paramount|peacock)/i,
  /which\s+service/i,
  /can\s+i\s+watch/i,
  /what\s+platform/i,
];

const RECOMMENDATION_PATTERNS = [
  /recommend/i,
  /suggest/i,
  /what\s+should\s+i\s+watch/i,
  /something\s+(like|similar)/i,
  /i('m|\s+am)\s+(in\s+the\s+)?mood\s+for/i,
  /show\s+me/i,
  /find\s+me/i,
  /looking\s+for/i,
  /what('s|s)\s+good/i,
  /any\s+good/i,
  /best\s+(movies?|shows?|series)/i,
  /top\s+(movies?|shows?|series)/i,
];

const PREFERENCES_PATTERNS = [
  /i\s+(like|love|enjoy|prefer)/i,
  /my\s+favorite/i,
  /i\s+(don'?t|hate|dislike)\s+(like|want|enjoy)/i,
  /change\s+my\s+preferences/i,
  /update\s+my\s+taste/i,
  /i('m|\s+am)\s+into/i,
];

const SOCIAL_PATTERNS = [
  /friends?('s?|\s+are)\s+(watching|liked|saved)/i,
  /what\s+are\s+my\s+friends/i,
  /friends?\s+picks/i,
  /social\s+feed/i,
];

export function classifyIntent(message: string): IntentClassification {
  const trimmed = message.trim();
  const entities = extractEntities(trimmed);

  // Check patterns in order of specificity
  if (matchesAny(trimmed, AVAILABILITY_PATTERNS)) {
    return {
      intent: "availability",
      confidence: 0.85,
      entities,
      rawQuery: trimmed,
    };
  }

  if (matchesAny(trimmed, PREFERENCES_PATTERNS)) {
    return {
      intent: "preferences",
      confidence: 0.8,
      entities,
      rawQuery: trimmed,
    };
  }

  if (matchesAny(trimmed, SOCIAL_PATTERNS)) {
    return {
      intent: "social",
      confidence: 0.8,
      entities,
      rawQuery: trimmed,
    };
  }

  if (matchesAny(trimmed, RECOMMENDATION_PATTERNS)) {
    return {
      intent: "recommendations",
      confidence: 0.8,
      entities,
      rawQuery: trimmed,
    };
  }

  // Default: if entities suggest a title search, classify as search
  if (entities.titles?.length || entities.genres?.length) {
    return {
      intent: "search",
      confidence: 0.6,
      entities,
      rawQuery: trimmed,
    };
  }

  // Fallback: treat as search
  return {
    intent: "search",
    confidence: 0.4,
    entities,
    rawQuery: trimmed,
  };
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

// ============================================================================
// Entity Extraction (Rules-Based)
// ============================================================================

const GENRE_MAP: Record<string, string> = {
  action: "Action",
  adventure: "Adventure",
  animation: "Animation",
  comedy: "Comedy",
  crime: "Crime",
  documentary: "Documentary",
  drama: "Drama",
  family: "Family",
  fantasy: "Fantasy",
  history: "History",
  horror: "Horror",
  music: "Music",
  mystery: "Mystery",
  romance: "Romance",
  "sci-fi": "Science Fiction",
  "science fiction": "Science Fiction",
  scifi: "Science Fiction",
  thriller: "Thriller",
  war: "War",
  western: "Western",
};

const SERVICE_MAP: Record<string, string> = {
  netflix: "Netflix",
  hulu: "Hulu",
  disney: "Disney Plus",
  "disney+": "Disney Plus",
  "disney plus": "Disney Plus",
  amazon: "Amazon Prime Video",
  "prime video": "Amazon Prime Video",
  "amazon prime": "Amazon Prime Video",
  hbo: "HBO Max",
  "hbo max": "HBO Max",
  apple: "Apple TV Plus",
  "apple tv": "Apple TV Plus",
  "apple tv+": "Apple TV Plus",
  paramount: "Paramount Plus",
  "paramount+": "Paramount Plus",
  peacock: "Peacock",
  crunchyroll: "Crunchyroll",
};

const MOOD_MAP: Record<string, string> = {
  funny: "comedy",
  scary: "horror",
  intense: "thriller",
  romantic: "romance",
  uplifting: "feel-good",
  "feel good": "feel-good",
  "feel-good": "feel-good",
  dark: "dark",
  lighthearted: "lighthearted",
  suspenseful: "suspense",
  emotional: "emotional",
  epic: "epic",
  nostalgic: "nostalgic",
  cerebral: "cerebral",
  "mind-bending": "cerebral",
};

export function extractEntities(message: string): ExtractedEntities {
  const lower = message.toLowerCase();
  const result: ExtractedEntities = {};

  // Extract genres
  const genres: string[] = [];
  for (const [pattern, genre] of Object.entries(GENRE_MAP)) {
    if (lower.includes(pattern)) {
      genres.push(genre);
    }
  }
  if (genres.length > 0) {
    result.genres = [...new Set(genres)];
  }

  // Extract services
  const services: string[] = [];
  for (const [pattern, service] of Object.entries(SERVICE_MAP)) {
    if (lower.includes(pattern)) {
      services.push(service);
    }
  }
  if (services.length > 0) {
    result.services = [...new Set(services)];
  }

  // Extract moods
  const moods: string[] = [];
  for (const [pattern, mood] of Object.entries(MOOD_MAP)) {
    if (lower.includes(pattern)) {
      moods.push(mood);
    }
  }
  if (moods.length > 0) {
    result.moods = [...new Set(moods)];
  }

  // Extract duration constraints
  const durationMatch = lower.match(
    /(?:under|less\s+than|shorter\s+than|within)\s+(\d+)\s*(?:min(?:utes?)?|hrs?|hours?)/
  );
  if (durationMatch) {
    const val = parseInt(durationMatch[1]!, 10);
    const unit = durationMatch[0]!.includes("hr") || durationMatch[0]!.includes("hour")
      ? val * 60
      : val;
    result.duration = { max: unit };
  }

  const durationMinMatch = lower.match(
    /(?:over|more\s+than|longer\s+than|at\s+least)\s+(\d+)\s*(?:min(?:utes?)?|hrs?|hours?)/
  );
  if (durationMinMatch) {
    const val = parseInt(durationMinMatch[1]!, 10);
    const unit =
      durationMinMatch[0]!.includes("hr") || durationMinMatch[0]!.includes("hour")
        ? val * 60
        : val;
    result.duration = { ...result.duration, min: unit };
  }

  // Extract year constraints
  const yearMatch = lower.match(/(?:from|after|since)\s+(\d{4})/);
  if (yearMatch) {
    result.releaseYear = { min: parseInt(yearMatch[1]!, 10) };
  }
  const yearBeforeMatch = lower.match(/(?:before|until|up\s+to)\s+(\d{4})/);
  if (yearBeforeMatch) {
    result.releaseYear = {
      ...result.releaseYear,
      max: parseInt(yearBeforeMatch[1]!, 10),
    };
  }

  // Extract region
  const regionMatch = lower.match(
    /\b(?:in\s+the\s+)?(us|uk|ca|au|de|fr|jp|kr|in|br)\b/
  );
  if (regionMatch) {
    result.region = regionMatch[1]!.toUpperCase();
  }

  // Extract potential title names (quoted strings)
  const quotedTitles = message.match(/"([^"]+)"/g);
  if (quotedTitles) {
    result.titles = quotedTitles.map((t) => t.replace(/"/g, ""));
  }

  return result;
}

// ============================================================================
// Worker Routing
// ============================================================================

const INTENT_WORKER_MAP: Record<UserIntent, WorkerPipeline> = {
  search: { parallel: ["preferences"], sequential: ["search", "recommendations"] },
  availability: { parallel: [], sequential: ["availability"] },
  recommendations: { parallel: ["preferences"], sequential: ["recommendations"] },
  preferences: { parallel: [], sequential: ["preferences"] },
  social: { parallel: ["preferences"], sequential: ["recommendations"] },
  unknown: { parallel: [], sequential: ["search", "recommendations"] },
};

interface WorkerPipeline {
  parallel: string[];
  sequential: string[];
}

async function routeToWorkers(
  intent: IntentClassification,
  workerContext: WorkerContext,
  deps: OrchestratorDeps
): Promise<WorkerResult[]> {
  const pipeline = INTENT_WORKER_MAP[intent.intent];
  const results: WorkerResult[] = [];

  const baseInput: WorkerInput = {
    intent,
    context: workerContext,
  };

  // Execute parallel workers first (e.g., preferences loading)
  if (pipeline.parallel.length > 0) {
    const parallelResults = await Promise.all(
      pipeline.parallel.map((worker) =>
        executeWorker(worker, baseInput, deps)
      )
    );
    results.push(...parallelResults);
  }

  // Execute sequential workers (passing previous results for chaining)
  for (const worker of pipeline.sequential) {
    const input: WorkerInput = {
      ...baseInput,
      previousResults: results,
    };
    const result = await executeWorker(worker, input, deps);
    results.push(result);
  }

  return results;
}

async function executeWorker(
  workerName: string,
  input: WorkerInput,
  deps: OrchestratorDeps
): Promise<WorkerResult> {
  switch (workerName) {
    case "search": {
      const searchDeps: SearchWorkerDeps = { prisma: deps.prisma };
      if (deps.redis) searchDeps.redis = deps.redis;
      return executeSearch(input, searchDeps);
    }
    case "availability": {
      const availDeps: AvailabilityWorkerDeps = { prisma: deps.prisma };
      if (deps.redis) availDeps.redis = deps.redis;
      if (deps.mcpClient) availDeps.mcpClient = deps.mcpClient;
      return executeAvailability(input, availDeps);
    }
    case "preferences":
      return executePreferences(input, {
        prisma: deps.prisma,
      });
    case "recommendations": {
      const recsDeps: RecommendationsWorkerDeps = { prisma: deps.prisma };
      if (deps.redis) recsDeps.redis = deps.redis;
      return executeRecommendations(input, recsDeps);
    }
    default:
      logger.warn("Unknown worker requested", { worker: workerName });
      return {
        worker: workerName as WorkerResult["worker"],
        success: false,
        error: `Unknown worker: ${workerName}`,
        latencyMs: 0,
      };
  }
}

// ============================================================================
// Response Aggregation
// ============================================================================

function aggregateResults(
  sessionId: string,
  intent: IntentClassification,
  workerResults: WorkerResult[]
): OrchestratorOutput {
  const recommendations = extractRecommendations(workerResults);
  const reasoning = buildReasoning(intent, workerResults);
  const alternatives = extractAlternatives(workerResults, recommendations);
  const followUpQuestions = generateFollowUpQuestions(intent, workerResults);
  const fallbackUsed = !workerResults.some(
    (r) => r.success && r.tokenUsage && r.tokenUsage.total > 0
  );

  const output: OrchestratorOutput = {
    sessionId,
    recommendations,
    reasoning,
    fallbackUsed: true, // NLU is always a fallback since no LLM is used
    workerResults,
  };
  if (alternatives.length > 0) output.alternatives = alternatives;
  if (followUpQuestions.length > 0) output.followUpQuestions = followUpQuestions;
  return output;
}

function extractRecommendations(
  workerResults: WorkerResult[]
): RecommendationResult[] {
  const recsResult = workerResults.find(
    (r) => r.worker === "recommendations" && r.success
  );
  if (recsResult?.data) {
    const data = recsResult.data as { items?: RecommendationResult[] };
    return data.items || [];
  }

  // If no recommendations worker, build from search results
  const searchResult = workerResults.find(
    (r) => r.worker === "search" && r.success
  );
  if (searchResult?.data) {
    const data = searchResult.data as { items?: TitleResult[] };
    const items = data.items || [];
    return items.slice(0, 6).map((title) => ({
      title,
      score: 0,
      reason: "Matched your search",
    }));
  }

  // If availability worker, format as recommendations
  const availResult = workerResults.find(
    (r) => r.worker === "availability" && r.success
  );
  if (availResult?.data) {
    const data = availResult.data as {
      items?: Array<{ titleId: string; service: string; region: string; offerType: string }>;
    };
    // Availability results don't map directly to recommendations
    // Return empty — reasoning will describe availability
    return [];
  }

  return [];
}

function extractAlternatives(
  workerResults: WorkerResult[],
  primaryRecs: RecommendationResult[]
): TitleResult[] {
  const searchResult = workerResults.find(
    (r) => r.worker === "search" && r.success
  );
  if (!searchResult?.data) return [];

  const data = searchResult.data as { items?: TitleResult[] };
  const allItems = data.items || [];
  const primaryIds = new Set(primaryRecs.map((r) => r.title.id));

  // Return items not already in primary recommendations
  return allItems
    .filter((t) => !primaryIds.has(t.id))
    .slice(0, 4);
}

function buildReasoning(
  intent: IntentClassification,
  workerResults: WorkerResult[]
): string {
  const parts: string[] = [];

  switch (intent.intent) {
    case "search": {
      const searchResult = workerResults.find(
        (r) => r.worker === "search" && r.success
      );
      const data = searchResult?.data as { total?: number } | undefined;
      const total = data?.total || 0;
      if (total > 0) {
        parts.push(`Found ${total} results matching your search.`);
      } else {
        parts.push("No results found for your search.");
      }
      break;
    }
    case "availability": {
      const availResult = workerResults.find(
        (r) => r.worker === "availability" && r.success
      );
      const data = availResult?.data as {
        items?: Array<{ service: string; offerType: string }>;
        region?: string;
      } | undefined;
      const items = data?.items || [];
      if (items.length > 0) {
        const services = [...new Set(items.map((i) => i.service))];
        parts.push(
          `Available on ${services.join(", ")} in ${data?.region || "your region"}.`
        );
      } else {
        parts.push("Could not find availability information.");
      }
      break;
    }
    case "recommendations": {
      const recsResult = workerResults.find(
        (r) => r.worker === "recommendations" && r.success
      );
      const data = recsResult?.data as { items?: RecommendationResult[] } | undefined;
      const count = data?.items?.length || 0;
      if (count > 0) {
        parts.push(
          `Here are ${count} personalized recommendations based on your preferences.`
        );
      } else {
        parts.push(
          "I couldn't generate recommendations right now. Try telling me what genres or moods you enjoy."
        );
      }
      break;
    }
    case "preferences": {
      parts.push("I've noted your preferences.");
      break;
    }
    case "social": {
      parts.push(
        "Social features are coming soon! In the meantime, here are some recommendations."
      );
      break;
    }
    default:
      parts.push("Here's what I found based on your message.");
  }

  // Add entity context
  if (intent.entities.genres?.length) {
    parts.push(`Filtered by genres: ${intent.entities.genres.join(", ")}.`);
  }
  if (intent.entities.services?.length) {
    parts.push(
      `Focusing on: ${intent.entities.services.join(", ")}.`
    );
  }

  return parts.join(" ");
}

// ============================================================================
// Follow-Up Question Generation
// ============================================================================

function generateFollowUpQuestions(
  intent: IntentClassification,
  workerResults: WorkerResult[]
): string[] {
  const questions: string[] = [];

  // Check if preferences were loaded and user is cold-start
  const prefsResult = workerResults.find(
    (r) => r.worker === "preferences" && r.success
  );
  if (prefsResult?.data) {
    const data = prefsResult.data as { coldStart?: boolean };
    if (data.coldStart) {
      questions.push("What genres do you enjoy most?");
      questions.push("Which streaming services do you subscribe to?");
      return questions;
    }
  }

  switch (intent.intent) {
    case "search":
      questions.push("Would you like me to filter by a specific streaming service?");
      questions.push("Any preference for movies or TV shows?");
      break;
    case "availability":
      questions.push("Would you like recommendations for similar titles?");
      break;
    case "recommendations":
      questions.push("Want more recommendations like these?");
      questions.push("Should I narrow down by a specific mood or genre?");
      break;
    case "preferences":
      questions.push("Now that I know your preferences, would you like some recommendations?");
      break;
    default:
      questions.push("What kind of movies or shows are you in the mood for?");
  }

  return questions.slice(0, 2);
}
