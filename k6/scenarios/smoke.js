import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, PROFILE_ID, defaultThresholds } from '../config.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: defaultThresholds,
};

export default function () {
  // 1. Health check
  const health = http.get(`${BASE_URL}/healthz`);
  check(health, {
    'healthz returns 200': (r) => r.status === 200,
  });
  sleep(0.5);

  // 2. Search
  const search = http.get(`${BASE_URL}/search?q=comedy&size=5`);
  check(search, {
    'search returns 200': (r) => r.status === 200,
    'search has results array': (r) => {
      const body = r.json();
      return Array.isArray(body.results || body.hits || body);
    },
  });
  sleep(0.5);

  // 3. Analytics event
  const analyticsPayload = JSON.stringify({
    event: 'page_view',
    profileId: PROFILE_ID,
    payload: { page: '/home' },
  });
  const analytics = http.post(`${BASE_URL}/analytics`, analyticsPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(analytics, {
    'analytics returns 2xx': (r) => r.status >= 200 && r.status < 300,
  });
  sleep(0.5);

  // 4. Picks
  const picks = http.get(`${BASE_URL}/picks/${PROFILE_ID}`);
  check(picks, {
    'picks returns 200': (r) => r.status === 200,
    'picks has items': (r) => {
      const body = r.json();
      return Array.isArray(body.picks || body.results || body);
    },
  });
}
