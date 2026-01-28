import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  BASE_URL,
  PROFILE_ID,
  defaultThresholds,
  searchTerms,
  randomItem,
} from '../config.js';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // ramp up
    { duration: '1m', target: 20 },   // steady
    { duration: '30s', target: 50 },  // ramp up
    { duration: '1m', target: 50 },   // steady
    { duration: '30s', target: 0 },   // ramp down
  ],
  thresholds: defaultThresholds,
};

export default function () {
  const roll = Math.random();

  if (roll < 0.4) {
    // 40 % — Search
    const q = randomItem(searchTerms);
    const res = http.get(`${BASE_URL}/search?q=${q}&size=10`);
    check(res, { 'search 200': (r) => r.status === 200 });
  } else if (roll < 0.7) {
    // 30 % — Picks
    const res = http.get(`${BASE_URL}/picks/${PROFILE_ID}`);
    check(res, { 'picks 200': (r) => r.status === 200 });
  } else if (roll < 0.9) {
    // 20 % — Analytics
    const payload = JSON.stringify({
      event: 'page_view',
      profileId: PROFILE_ID,
      payload: { page: '/browse' },
    });
    const res = http.post(`${BASE_URL}/analytics`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    check(res, { 'analytics 2xx': (r) => r.status >= 200 && r.status < 300 });
  } else {
    // 10 % — Health
    const res = http.get(`${BASE_URL}/healthz`);
    check(res, { 'healthz 200': (r) => r.status === 200 });
  }

  sleep(1);
}
