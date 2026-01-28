# Runbook: External API Failure

## Trigger
- MCP retry/backoff logs escalating
- Stale availability or ratings data
- Ingestion pipeline failures

## Affected Services

| Provider | Used For | Impact When Down |
|----------|---------|------------------|
| TMDB | Titles, availability, trending | No new data ingestion; search uses stale index |
| OMDB | External ratings (IMDb, RT, Metacritic) | Ratings not updated; existing ratings still served |
| Trakt | Trending signals | Trending data stale; popularity rankings unchanged |
| JustWatch | Availability (MCP) | Chat availability queries return cached/local data |

## Investigation Steps

### 1. Check MCP Logs
Look for retry escalation patterns:
- `mcp_retry attempt=1 backoff=1000ms`
- `mcp_retry attempt=3 backoff=8000ms` — provider likely degraded
- `mcp_max_retries_exceeded` — provider is down

### 2. Check Provider Status
- TMDB: https://www.themoviedb.org/talk (community reports)
- OMDB: check API response directly
- Trakt: https://status.trakt.tv

### 3. Verify Local Data Freshness
```sql
-- Last ingested title
SELECT MAX("updatedAt") FROM "Title";

-- Last availability update
SELECT MAX("updatedAt") FROM "Availability";

-- Last ratings update
SELECT MAX("updatedAt") FROM "ExternalRating";

-- Last trending signal
SELECT MAX("createdAt") FROM "TrendingSignal";
```

### 4. Check Rate Limits
Providers may return 429 (rate limited):
- TMDB: 40 requests/10 seconds
- OMDB: 1000 requests/day (free tier)
- Ensure ingestion batching respects these limits

## Resolution

| Scenario | Action |
|----------|--------|
| Provider temporarily down | MCP backoff handles automatically; wait for recovery |
| Provider rate limited | Reduce ingestion batch size; increase delay between requests |
| Provider API changed | Update provider normalization in `services/catalog/` |
| Stale data > SLO | Notify users of degraded freshness; prioritize recovery |

## Fallback Behavior

The system degrades gracefully when external APIs are unavailable:
- **MCP Layer**: Configurable retry count (`MCP_MAX_RETRIES=3`) with exponential backoff (`MCP_BACKOFF_MS=1000`)
- **Cache**: MCP responses cached for `MCP_CACHE_SECONDS=300`
- **Local data**: `AVAILABILITY_SOURCE=LOCAL` serves from PostgreSQL without external calls
- **LLM fallback**: If chat provider is down, NLU rules engine provides basic search

## Escalation
- If data freshness exceeds SLO for > 6 hours, investigate and notify stakeholders
- If provider has changed API contract, prioritize adapter updates
