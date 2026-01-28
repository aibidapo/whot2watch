import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  BASE_URL,
  PROFILE_ID,
  stressThresholds,
  searchTerms,
  randomItem,
} from '../config.js';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '1m', target: 200 },
    { duration: '1m', target: 200 },  // sustained peak
    { duration: '30s', target: 0 },   // ramp down
  ],
  thresholds: stressThresholds,
};

export default function () {
  const roll = Math.random();

  if (roll < 0.4) {
    const q = randomItem(searchTerms);
    const res = http.get(`${BASE_URL}/search?q=${q}&size=10`);
    check(res, { 'search ok': (r) => r.status === 200 });
  } else if (roll < 0.7) {
    const res = http.get(`${BASE_URL}/picks/${PROFILE_ID}`);
    check(res, { 'picks ok': (r) => r.status === 200 });
  } else if (roll < 0.9) {
    const payload = JSON.stringify({
      event: 'page_view',
      profileId: PROFILE_ID,
      payload: { page: '/browse' },
    });
    const res = http.post(`${BASE_URL}/analytics`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    check(res, { 'analytics ok': (r) => r.status >= 200 && r.status < 300 });
  } else {
    const res = http.get(`${BASE_URL}/healthz`);
    check(res, { 'healthz ok': (r) => r.status === 200 });
  }

  sleep(0.5);
}
