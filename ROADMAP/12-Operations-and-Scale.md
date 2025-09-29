# Epic 12 — Operations & Scale (W6–W12)

Checklist

- [ ] Monitoring & alerting (APM, logs, dashboards, alerts)
- [ ] Performance & load testing (k6/Artillery)
- [ ] Cost monitoring & budgets
- [ ] Scaling strategy (autoscaling, caching, CDNs)
- [ ] Backups & disaster recovery runbook

Acceptance Criteria

- Dashboards live for API latency, ingest success, errors, cost
- Load tests pass targets (P95 picks < 300ms, search < 500ms)
- Budget alerts configured; monthly cost reported
- Backups verified and restoration drills documented

Step-by-Step Implementation Plan

1. Monitoring

- Instrument API and workers; ship logs; set alerts (error rate, latency, retries)

2. Load/Perf

- Write scenarios for search/picks/ingest; optimize slow paths; cache hot queries

3. Cost & Scaling

- Add cost dashboards; set budgets; configure autoscaling where applicable; use CDN for static assets

4. DR

- Postgres backups and OpenSearch snapshots; recovery steps documented and tested
