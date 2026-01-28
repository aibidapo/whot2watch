# k6 Load Tests

Performance and load testing for the Whot2Watch API using [k6](https://k6.io/).

## Prerequisites

- **k6 binary** — [install guide](https://grafana.com/docs/k6/latest/set-up/install-k6/)
- **API running** — `pnpm api:dev` (or point to staging via `BASE_URL`)
- **Database seeded** — `pnpm db:seed` (smoke/load tests hit search and picks endpoints)

## Scenarios

| Script | VUs | Purpose |
|--------|-----|---------|
| `smoke.js` | 1 VU, 1 iteration | Sanity check — validates endpoints respond correctly |
| `load.js` | Ramp to 50 VUs | Normal load — verifies P95 < 600 ms |
| `stress.js` | Ramp to 200 VUs | Stress — finds breaking points, P99 < 2 s |
| `chat.js` | Ramp to 10 VUs | AI concierge — LLM latency budget P95 < 3 s |

## Running

```bash
# Smoke (quick sanity)
pnpm k6:smoke
# or directly:
k6 run k6/scenarios/smoke.js

# Load test
pnpm k6:load

# Stress test
pnpm k6:stress

# Chat / AI concierge
pnpm k6:chat
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:4000` | API base URL |
| `PROFILE_ID` | `1` | Profile ID for picks/analytics endpoints |

Override via `-e` flag:

```bash
k6 run -e BASE_URL=https://staging.whot2watch.dev -e PROFILE_ID=42 k6/scenarios/load.js
```

## Thresholds (P95 Targets)

| Scenario | P95 Target | Error Rate |
|----------|-----------|------------|
| Load | < 600 ms | < 1 % |
| Stress | < 2 000 ms (P99) | < 5 % |
| Chat | < 3 000 ms | < 5 % |

Thresholds are defined in `k6/config.js`. If a threshold is breached, k6 exits with a non-zero code.

## Interpreting Results

After a run, k6 prints a summary including:

- **http_req_duration** — response time percentiles (P50, P90, P95, P99)
- **http_req_failed** — percentage of non-2xx responses
- **iterations** — total completed iterations
- **vus_max** — peak concurrent virtual users

A passing run means all threshold conditions were met. Focus on P95/P99 values relative to the targets above.
