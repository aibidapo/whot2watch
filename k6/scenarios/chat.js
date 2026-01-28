import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, chatThresholds, randomItem } from '../config.js';

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '2m', target: 10 },
    { duration: '30s', target: 0 },
  ],
  thresholds: chatThresholds,
};

const chatQueries = [
  'Find me a funny movie to watch tonight',
  'What horror films are on Netflix?',
  'Recommend something like Stranger Things',
  'Short documentary under 90 minutes',
  'Best sci-fi series on Disney+',
  'Family-friendly adventure movies',
  'Something thrilling with a twist ending',
  'Top rated dramas from 2024',
  'Romantic comedies on Hulu',
  'Action movies similar to John Wick',
];

export default function () {
  const query = randomItem(chatQueries);
  const payload = JSON.stringify({
    message: query,
    sessionId: `k6-load-${__VU}-${__ITER}`,
  });

  const res = http.post(`${BASE_URL}/v1/chat`, payload, {
    headers: { 'Content-Type': 'application/json' },
    // LLM calls may take longer; set per-request timeout
    timeout: '10s',
  });

  check(res, {
    'chat returns 200 or 503': (r) => r.status === 200 || r.status === 503,
    'chat body is JSON': (r) => {
      try {
        r.json();
        return true;
      } catch {
        return false;
      }
    },
  });

  // Longer pause between chat requests to simulate real conversation cadence
  sleep(3);
}
