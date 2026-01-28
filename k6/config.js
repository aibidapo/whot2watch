/**
 * Shared k6 configuration — base URL, profile ID, thresholds, helpers.
 */

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
export const PROFILE_ID = __ENV.PROFILE_ID || '1';

/** Shared threshold presets (P95 < 600 ms per ROADMAP/06 acceptance criteria). */
export const defaultThresholds = {
  http_req_duration: ['p(95)<600'],
  http_req_failed: ['rate<0.01'],
};

/** Relaxed thresholds for stress scenarios. */
export const stressThresholds = {
  http_req_duration: ['p(99)<2000'],
  http_req_failed: ['rate<0.05'],
};

/** Thresholds for LLM-backed endpoints (higher latency budget). */
export const chatThresholds = {
  http_req_duration: ['p(95)<3000'],
  http_req_failed: ['rate<0.05'],
};

/** Random search terms for realistic query distribution. */
export const searchTerms = [
  'comedy',
  'horror',
  'sci-fi',
  'drama',
  'action',
  'thriller',
  'romance',
  'documentary',
  'animation',
  'fantasy',
  'mystery',
  'western',
  'crime',
  'family',
  'adventure',
];

/**
 * Pick a random element from an array.
 * @param {Array} arr
 * @returns {*}
 */
export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
