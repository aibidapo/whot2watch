# Observability — What2Watch

## Structured Logging

- **Module**: `server/common/logger.ts`
- **Format**: JSON with `level`, `msg`, `ts`, `requestId`, `context` fields
- **Redaction**: Auto-redacts keys matching `auth`, `token`, `secret`, `password`, `cookie`, `authorization`
- **Request ID**: `server/common/requestId.ts` adds `x-request-id` header (UUID v4) to every request; propagated through all log entries

## APM Integration

- **Fastify hooks**: `onRequest` and `onResponse` hooks log request duration, status code, and route
- **Redis**: Connection health checked on startup; graceful degradation logged at `warn` level when unavailable
- **OpenSearch**: Index operations log document counts and timing; connection failures logged at `error` level
- **Prisma**: Query logging enabled in development (`log: ['query']`); disabled in production for performance

## Error Taxonomy

| Category | HTTP Status | Log Level | Example |
|----------|-------------|-----------|---------|
| Validation error | 400 | `warn` | Invalid query params, malformed JSON body |
| Authentication failure | 401 | `warn` | Missing/invalid JWT, expired token |
| Authorization denial | 403 | `warn` | Non-premium user accessing premium endpoint |
| Not found | 404 | `info` | Unknown profile ID, missing title |
| Rate limit exceeded | 429 | `warn` | Per-IP or per-user burst limit hit |
| Internal error | 500 | `error` | Unhandled exception, database connection loss |
| External API failure | 502 | `error` | TMDB/OMDB/Trakt timeout or 5xx response |

## Alerting Rules (Recommended)

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error rate (5xx) | > 1% of requests over 5 min | Page on-call |
| P95 latency | > 2s for 5 consecutive minutes | Slack alert |
| Database connection pool exhaustion | 0 available connections | Page on-call |
| Redis disconnection | > 30s unreachable | Slack alert |
| External API error rate | > 10% of calls over 10 min | Slack alert |
| Disk / memory usage | > 85% | Slack alert |

## Dashboard Recommendations

- **Request overview**: RPS, P50/P95/P99 latency, error rate by route
- **Database**: Query latency, connection pool usage, migration status
- **External APIs**: Call volume, error rate, and latency per provider (TMDB, OMDB, Trakt)
- **Business metrics**: Search volume, picks served, feedback actions, alert fire rate

## Log Aggregation Guidance

- Ship JSON logs to a central aggregator (Datadog, OpenSearch, CloudWatch, or Grafana Loki)
- Index on: `requestId`, `level`, `route`, `statusCode`, `userId`
- Retention: 30 days hot, 90 days warm, 1 year cold (compliance)
- Sampling: In high-traffic production, sample `info`-level logs at 10%; keep all `warn`+ logs
