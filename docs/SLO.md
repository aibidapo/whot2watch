# Service Level Objectives (SLOs)

## Availability

| Service | SLO | Error Budget (30 days) |
|---------|-----|----------------------|
| API (overall) | 99.5% | 3.6 hours |
| Search endpoint | 99.5% | 3.6 hours |
| Chat endpoint | 99.0% | 7.2 hours |

Measured as: `1 - (5xx responses / total responses)` over rolling 30-day window.

## Latency

| Endpoint | P50 | P95 | P99 |
|----------|-----|-----|-----|
| `GET /search` | < 200 ms | < 600 ms | < 1500 ms |
| `GET /picks/:id` | < 150 ms | < 600 ms | < 1500 ms |
| `POST /v1/chat` | < 1000 ms | < 3000 ms | < 5000 ms |
| `GET /healthz` | < 50 ms | < 100 ms | < 200 ms |

## Error Rate

- **Target**: < 1% 5xx responses over any 5-minute window
- **Critical alert**: > 5% 5xx over 2-minute window

## Data Freshness

| Data Type | Freshness SLO |
|-----------|--------------|
| Streaming availability | < 6 hours from TMDB update |
| External ratings (IMDb, RT, Metacritic) | < 24 hours |
| Trending signals | < 1 hour |
| Search index | < 30 minutes after DB write |

## Burn Rate Alerting

Alerts fire based on how quickly the error budget is being consumed:

| Burn Rate | Budget Consumed In | Alert Severity | Action |
|-----------|-------------------|----------------|--------|
| 14.4x | 1 hour | Critical (page) | Immediate investigation |
| 6x | 6 hours | Warning (ticket) | Investigate within shift |
| 1x | 30 days | Info (dashboard) | Track in weekly review |

## Measurement

- APM middleware (`server/apm/middleware.ts`) records per-route latency and status codes
- `/v1/admin/metrics` exposes P50/P95/P99 and error rates
- k6 load tests validate thresholds in CI (smoke) and scheduled runs (load/stress)

## Review Cadence

- Weekly: review SLO dashboard, burn rate alerts
- Monthly: review error budget consumption, adjust thresholds if needed
- Quarterly: review SLO targets against business requirements
