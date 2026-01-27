/**
 * NLU Entity Extraction (Rules-Based)
 * Epic 8: AI & Social — Shared NLU utilities for AI Concierge and search bar
 *
 * Extracts structured entities (genres, services, moods, duration, year, region)
 * from natural-language queries using pattern matching.
 */

import type { ExtractedEntities } from "./types";

// ============================================================================
// Entity Maps
// ============================================================================

export const GENRE_MAP: Record<string, string> = {
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

export const SERVICE_MAP: Record<string, string> = {
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

export const MOOD_MAP: Record<string, string> = {
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

// ============================================================================
// Entity Extraction
// ============================================================================

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
// Entity Stripping — removes matched patterns from query for clean search text
// ============================================================================

/** Regex patterns that match entity phrases to strip from the query */
const SERVICE_STRIP_PATTERNS: RegExp[] = Object.keys(SERVICE_MAP)
  .sort((a, b) => b.length - a.length) // longest first to avoid partial matches
  .map((key) => new RegExp(`\\b(?:on\\s+)?${key.replace(/[+]/g, "\\+")}\\b`, "gi"));

const DURATION_STRIP = /(?:under|less\s+than|shorter\s+than|within|over|more\s+than|longer\s+than|at\s+least)\s+\d+\s*(?:min(?:utes?)?|hrs?|hours?)/gi;
const YEAR_STRIP = /(?:from|after|since|before|until|up\s+to)\s+\d{4}/gi;
const REGION_STRIP = /\b(?:in\s+the\s+)?(us|uk|ca|au|de|fr|jp|kr|in|br)\b/gi;
const QUOTED_STRIP = /"[^"]+"/g;

export function stripEntities(message: string): string {
  let stripped = message;

  // Remove quoted titles
  stripped = stripped.replace(QUOTED_STRIP, "");

  // Remove service patterns (longest first)
  for (const re of SERVICE_STRIP_PATTERNS) {
    re.lastIndex = 0;
    stripped = stripped.replace(re, "");
  }

  // Remove duration phrases
  stripped = stripped.replace(DURATION_STRIP, "");

  // Remove year phrases
  stripped = stripped.replace(YEAR_STRIP, "");

  // Remove region phrases
  stripped = stripped.replace(REGION_STRIP, "");

  // Collapse whitespace and trim
  return stripped.replace(/\s+/g, " ").trim();
}
