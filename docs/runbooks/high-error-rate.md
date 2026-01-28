# Runbook: High Error Rate

## Trigger
5xx error rate exceeds 1% over a 5-minute window, or > 5% over a 2-minute window (critical).

## Symptoms
- Elevated 5xx responses in APM dashboard
- User-facing errors in the frontend
- Burn rate alert fires

## Investigation Steps

### 1. Check APM Metrics
```
GET /v1/admin/metrics
```
Review `errorRate`, `routeLatencies`, and `uptime`. Identify which routes have elevated error rates.

### 2. Check Application Logs
Look for recurring error patterns:
- Database connection errors (`PrismaClientKnownRequestError`)
- Redis connection timeouts
- OpenSearch cluster red/yellow status
- External API failures (TMDB, OMDB)

### 3. Check Database Connectivity
- Verify PostgreSQL is reachable and accepting connections
- Check connection pool usage (warning at 70%, critical at 90%)
- Look for long-running queries or locks

### 4. Check External Dependencies
- Redis: `redis-cli ping` — should return `PONG`
- OpenSearch: `GET /` — should return cluster info
- TMDB API: check MCP retry logs for backoff escalation

### 5. Check Recent Deployments
- Correlate error spike with deployment timestamps
- Review recent commits for breaking changes

## Resolution

| Root Cause | Action |
|-----------|--------|
| Database connection exhaustion | Restart API to reset pool; increase pool size |
| Redis unavailable | API degrades gracefully; restart Redis if needed |
| OpenSearch down | Search returns empty; restart or reindex |
| External API outage | MCP handles retry/backoff automatically; wait for recovery |
| Code regression | Roll back to previous deployment |

## Escalation
- If unresolved after 15 minutes, escalate to on-call engineer
- If data integrity is affected, follow [Database Issues](./database-issues.md) runbook
