/**
 * Analytics Event Validator — Epic 5
 *
 * Loads JSON Schema files from the analytics events directory and validates
 * incoming events at runtime. Sampling controls and permissive fallback
 * ensure the validator never blocks production traffic.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../common/logger';

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

// ============================================================================
// Schema Cache
// ============================================================================

let schemaCache: Map<string, any> | null = null;
let envelopeSchema: any = null;

function getEventsDir(): string {
  // Try multiple locations for the analytics schema directory
  const candidates = [
    path.resolve(process.cwd(), 'whot2watch-docs/docs/analytics/events'),
    path.resolve(process.cwd(), 'Whot2Watch-docs/docs/analytics/events'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0]!;
}

function getEnvelopePath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'whot2watch-docs/docs/analytics/event-envelope.schema.json'),
    path.resolve(process.cwd(), 'Whot2Watch-docs/docs/analytics/event-envelope.schema.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0]!;
}

function loadSchemas(): Map<string, any> {
  if (schemaCache) return schemaCache;
  schemaCache = new Map();
  try {
    const dir = getEventsDir();
    if (!fs.existsSync(dir)) return schemaCache;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.schema.json'));
    for (const file of files) {
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
      const schema = JSON.parse(raw);
      const eventName = file.replace('.schema.json', '');
      schemaCache.set(eventName, schema);
    }
  } catch (err) {
    logger.warn('analytics_schema_load_failed', { err: String(err) });
  }
  return schemaCache;
}

function loadEnvelopeSchema(): any {
  if (envelopeSchema !== undefined && envelopeSchema !== null) return envelopeSchema;
  try {
    const p = getEnvelopePath();
    if (fs.existsSync(p)) {
      envelopeSchema = JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  } catch (err) {
    logger.warn('analytics_envelope_schema_load_failed', { err: String(err) });
  }
  return envelopeSchema;
}

// ============================================================================
// Simple JSON Schema Validator (no Ajv dependency needed)
// ============================================================================

function validateRequiredFields(data: Record<string, any>, schema: any): string[] {
  const errors: string[] = [];
  const required: string[] = schema.required || [];
  for (const field of required) {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  // Basic property type checks
  const props = schema.properties || {};
  for (const [key, spec] of Object.entries(props) as [string, any][]) {
    if (data[key] === undefined || data[key] === null) continue;
    if (spec.type === 'string' && typeof data[key] !== 'string') {
      errors.push(`Field ${key} should be string, got ${typeof data[key]}`);
    }
    if (spec.type === 'integer' && !Number.isInteger(data[key])) {
      errors.push(`Field ${key} should be integer`);
    }
    if (spec.type === 'boolean' && typeof data[key] !== 'boolean') {
      errors.push(`Field ${key} should be boolean`);
    }
    if (spec.type === 'array' && !Array.isArray(data[key])) {
      errors.push(`Field ${key} should be array`);
    }
    if (spec.enum && !spec.enum.includes(data[key])) {
      errors.push(`Field ${key} has invalid enum value: ${data[key]}`);
    }
  }
  return errors;
}

// ============================================================================
// Public API
// ============================================================================

function getSampleRate(): number {
  const env = process.env.ANALYTICS_VALIDATION_SAMPLE_RATE;
  if (env !== undefined) return Number(env);
  return process.env.NODE_ENV === 'production' ? 0.1 : 1.0;
}

function isValidationEnabled(): boolean {
  return process.env.ANALYTICS_VALIDATION_ENABLED !== 'false';
}

export function validateAnalyticsEvent(
  eventName: string,
  properties: Record<string, any>,
): ValidationResult {
  if (!isValidationEnabled()) return { valid: true };
  if (Math.random() >= getSampleRate()) return { valid: true };

  try {
    const schemas = loadSchemas();
    const schema = schemas.get(eventName);
    if (!schema) {
      // Unknown event name → permissive pass
      return { valid: true };
    }
    const errors = validateRequiredFields(properties, schema);
    if (errors.length > 0) {
      return { valid: false, errors };
    }
    return { valid: true };
  } catch {
    // Never throw — permissive on error
    return { valid: true };
  }
}

export function validateEnvelope(envelope: Record<string, any>): ValidationResult {
  if (!isValidationEnabled()) return { valid: true };
  if (Math.random() >= getSampleRate()) return { valid: true };

  try {
    const schema = loadEnvelopeSchema();
    if (!schema) return { valid: true };
    const errors = validateRequiredFields(envelope, schema);
    if (errors.length > 0) {
      return { valid: false, errors };
    }
    return { valid: true };
  } catch {
    return { valid: true };
  }
}

/** Reset cached schemas (for testing). */
export function _resetSchemaCache(): void {
  schemaCache = null;
  envelopeSchema = null;
}
