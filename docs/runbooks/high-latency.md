# Runbook: High Latency

## Trigger
P95 latency exceeds SLO threshold:
- Search/Picks: P95 > 600 ms
- Chat: P95 > 3000 ms

## Symptoms
- Slow page loads in frontend
- k6 threshold failures in CI
- APM dashboard shows elevated latency percentiles

## Investigation Steps

### 1. Check APM Snapshot
```
GET /v1/admin/metrics
```
Review `routeLatencies` to identify which routes are slow. Compare P50 vs P95 — a large gap indicates tail latency issues.

### 2. Identify Slow Routes
Common bottlenecks by route:
- `/search` — OpenSearch query time, index size, query complexity
- `/picks/:id` — PostgreSQL query (joins across titles, availability, ratings)
- `/v1/chat` — LLM response time, MCP tool calls

### 3. Check OpenSearch Performance
```
GET /_cluster/health
GET /_cat/indices?v
GET /_cat/nodes?v&h=name,heap.percent,cpu
```
- Heap > 70%: consider scaling or reducing index size
- Cluster yellow/red: check node availability

### 4. Check PostgreSQL Performance
- Look for slow queries in logs (log_min_duration_statement)
- Check for missing indexes on frequently queried columns
- Verify connection pool is not saturated

### 5. Check Redis Cache Hit Rate
- Low cache hit rate means more DB/OpenSearch queries
- Verify Redis is available and cache TTLs are appropriate

### 6. Check LLM Provider (Chat endpoint)
- Review MCP logs for retry escalation
- Check LLM provider status page
- Verify token limits are not causing truncation/retries

## Resolution

| Root Cause | Action |
|-----------|--------|
| OpenSearch slow queries | Optimize query, add/adjust ngram analyzer, scale nodes |
| Missing DB indexes | Add indexes via Prisma migration |
| Connection pool saturation | Increase pool size, add read replica |
| LLM provider slow | Fallback chain handles this; check NLU fallback is active |
| High traffic | Scale API horizontally; see [Capacity Planning](../CapacityPlanning.md) |

## Escalation
- If P95 exceeds 2x SLO for > 30 minutes, escalate to on-call
- If chat endpoint is affected, check LLM provider status and cost controls
