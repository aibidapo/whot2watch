/**
 * Safety Filters
 * Epic 8: AI & Social — Input/output filtering, prompt redaction
 *
 * Provides:
 * - Input sanitization (prompt injection detection, length checks)
 * - Output filtering (blocks unsafe or irrelevant content)
 * - Prompt redaction for logging (hashes raw prompts, strips PII)
 *
 * Reference: docs/adr/0002-mcp-agentic-architecture.md
 */

import { createHash } from "crypto";
import { getSafetyConfig, type SafetyConfig } from "./config";
import { createLogger } from "../common/logger";

const logger = createLogger("safety");

// ============================================================================
// Types
// ============================================================================

export interface SafetyCheckResult {
  safe: boolean;
  reason?: string;
  filtered?: string;
}

export interface RedactedPrompt {
  hash: string;
  length: number;
  redacted: string;
}

// ============================================================================
// Input Safety
// ============================================================================

/**
 * Check whether a user message is safe to process.
 * Returns { safe: false, reason } if the input should be rejected.
 */
export function checkInputSafety(message: string): SafetyCheckResult {
  const config = getSafetyConfig();

  if (!config.safetyFilterEnabled) {
    return { safe: true };
  }

  // Length check
  if (message.length > 2000) {
    return { safe: false, reason: "Message exceeds maximum length" };
  }

  if (message.trim().length === 0) {
    return { safe: false, reason: "Message is empty" };
  }

  // Prompt injection detection
  for (const pattern of config.blockedPatterns) {
    if (pattern.test(message)) {
      logger.warn("Blocked input: prompt injection pattern detected", {
        patternSource: pattern.source,
        messageHash: hashText(message),
      });
      return {
        safe: false,
        reason: "Your message contains a pattern that cannot be processed",
      };
    }
  }

  // Excessive special characters (potential injection)
  const specialCharRatio = countSpecialChars(message) / message.length;
  if (message.length > 20 && specialCharRatio > 0.5) {
    logger.warn("Blocked input: excessive special characters", {
      ratio: specialCharRatio.toFixed(2),
      messageHash: hashText(message),
    });
    return {
      safe: false,
      reason: "Your message contains too many special characters",
    };
  }

  return { safe: true };
}

// ============================================================================
// Output Safety
// ============================================================================

/** Patterns that should not appear in AI-generated output. */
const OUTPUT_BLOCK_PATTERNS = [
  // System prompt leakage
  /you\s+are\s+an?\s+AI\s+(language\s+)?model/i,
  /as\s+an?\s+AI\s+(language\s+)?model/i,
  /my\s+instructions\s+(are|say|tell)/i,
  // Personal data patterns
  /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/, // SSN-like
  /\b\d{16}\b/, // credit card-like (16 consecutive digits)
];

/**
 * Check whether an AI-generated response is safe to return.
 * Optionally returns a filtered version with unsafe content removed.
 */
export function checkOutputSafety(output: string): SafetyCheckResult {
  const config = getSafetyConfig();

  if (!config.safetyFilterEnabled) {
    return { safe: true };
  }

  for (const pattern of OUTPUT_BLOCK_PATTERNS) {
    if (pattern.test(output)) {
      logger.warn("Filtered output: blocked pattern detected", {
        patternSource: pattern.source,
        outputHash: hashText(output),
      });
      return {
        safe: false,
        reason: "Response contained filtered content",
        filtered: "I can help you find movies and shows to watch. What are you in the mood for?",
      };
    }
  }

  return { safe: true };
}

/**
 * Sanitize recommendation reasons to remove any injected content.
 * Keeps only safe descriptive text.
 */
export function sanitizeReason(reason: string): string {
  // Strip HTML/script tags
  let sanitized = reason.replace(/<[^>]*>/g, "");
  // Strip potential markdown injection
  sanitized = sanitized.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  // Truncate overly long reasons
  if (sanitized.length > 500) {
    sanitized = sanitized.slice(0, 497) + "...";
  }
  return sanitized;
}

// ============================================================================
// Prompt Redaction
// ============================================================================

/** PII patterns to redact from logged prompts. */
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Email addresses
  { pattern: /\b[\w.-]+@[\w.-]+\.\w{2,}\b/g, replacement: "[EMAIL]" },
  // Phone numbers (various formats)
  { pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: "[PHONE]" },
  // SSN
  { pattern: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g, replacement: "[SSN]" },
];

/**
 * Redact a prompt for safe logging.
 * Returns a hash, length, and PII-stripped version.
 */
export function redactPrompt(prompt: string): RedactedPrompt {
  const config = getSafetyConfig();

  const hash = hashText(prompt);
  const length = prompt.length;

  if (!config.promptRedactionEnabled) {
    return { hash, length, redacted: prompt };
  }

  let redacted = prompt;
  for (const { pattern, replacement } of PII_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }

  // Truncate for logging
  if (redacted.length > 200) {
    redacted = redacted.slice(0, 197) + "...";
  }

  return { hash, length, redacted };
}

// ============================================================================
// Helpers
// ============================================================================

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function countSpecialChars(text: string): number {
  let count = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    // Count non-alphanumeric, non-space, non-basic-punctuation
    if (
      !(code >= 48 && code <= 57) && // 0-9
      !(code >= 65 && code <= 90) && // A-Z
      !(code >= 97 && code <= 122) && // a-z
      code !== 32 && // space
      code !== 39 && // apostrophe
      code !== 44 && // comma
      code !== 46 && // period
      code !== 33 && // exclamation
      code !== 63 && // question mark
      code !== 45 // hyphen
    ) {
      count++;
    }
  }
  return count;
}

/**
 * Convenience: run full input safety pipeline.
 * Use this in the orchestrator before processing a message.
 */
export function validateInput(message: string): SafetyCheckResult {
  return checkInputSafety(message);
}

/**
 * Convenience: run full output safety pipeline.
 * Use this in the orchestrator before returning a response.
 */
export function validateOutput(output: string): SafetyCheckResult {
  return checkOutputSafety(output);
}
