# Operational Runbooks

Runbooks for common operational scenarios. Each runbook follows a structured format: symptoms, investigation steps, resolution, and escalation.

## Index

| Runbook | Trigger |
|---------|---------|
| [High Error Rate](./high-error-rate.md) | 5xx rate > 1% over 5-minute window |
| [High Latency](./high-latency.md) | P95 latency exceeds SLO threshold |
| [Database Issues](./database-issues.md) | Connection failures, slow queries, deadlocks |
| [External API Failure](./external-api-failure.md) | TMDB/OMDB/Trakt degradation or outage |

## General Triage Steps

1. Check `/healthz` endpoint — confirms API is reachable
2. Check `/v1/admin/metrics` — review APM snapshot (latency, error rates, uptime)
3. Check application logs for recent errors
4. Check infrastructure dashboards (DB connections, Redis memory, OpenSearch cluster health)
5. Check recent deployments — correlate with incident start time
