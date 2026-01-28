# Disaster Recovery Plan

## Recovery Objectives

| Metric | Target |
|--------|--------|
| **RTO** (Recovery Time Objective) | 1 hour (API), 4 hours (full data) |
| **RPO** (Recovery Point Objective) | 1 hour |

## Backup Strategy

| Component | Method | Frequency | Retention | Location |
|-----------|--------|-----------|-----------|----------|
| PostgreSQL | `pg_dump` (logical) | Every 6 hours | 30 days | Object storage (encrypted) |
| PostgreSQL | WAL archiving | Continuous | 7 days | Object storage |
| Redis | RDB snapshots | Every 1 hour | 24 hours | Local + replicated |
| OpenSearch | Snapshot API | Daily | 7 days | Object storage |
| Application config | Git repository | On commit | Indefinite | GitHub |
| Secrets | Vault / env secrets | On change | Versioned | Secret manager |

## Restoration Procedures

### PostgreSQL

1. Provision new PostgreSQL instance (same version)
2. Restore from latest `pg_dump`: `pg_restore -d w2w latest.dump`
3. If point-in-time recovery needed, replay WAL from archive
4. Run `pnpm prisma:migrate:deploy` to verify schema
5. Verify row counts against last known good state

### Redis

1. Provision new Redis instance
2. Copy latest RDB file to data directory
3. Start Redis — it loads from RDB automatically
4. Verify session and analytics queue state
5. If data is stale, analytics queue can be rebuilt from webhook logs

### OpenSearch

1. Register snapshot repository on new cluster
2. Restore latest snapshot: `POST /_snapshot/repo/latest/_restore`
3. If snapshot unavailable, reindex from PostgreSQL: `pnpm index:fromdb`
4. Verify document count: `GET /titles/_count`

### Full Recovery (all components)

1. Deploy infrastructure (Docker Compose or cloud provisioning)
2. Restore PostgreSQL (priority — source of truth)
3. Run migrations: `pnpm prisma:migrate:deploy`
4. Restore Redis (or start fresh — ephemeral data)
5. Restore OpenSearch (or reindex from DB)
6. Deploy API application
7. Verify health: `GET /healthz`
8. Run smoke test: `pnpm k6:smoke`

## Failure Scenario Matrix

| Scenario | Impact | RTO | Recovery |
|----------|--------|-----|----------|
| Single API instance crash | Minimal (if replicated) | < 1 min | Auto-restart / health check |
| PostgreSQL failure | Critical — no writes | < 1 hour | Restore from pg_dump + WAL |
| Redis failure | Degraded — no caching/sessions | < 15 min | Restart with RDB or fresh |
| OpenSearch failure | No search | < 30 min | Reindex from DB |
| Full datacenter outage | Total outage | < 4 hours | Full restore to alternate region |
| Data corruption | Varies | < 2 hours | Point-in-time recovery from WAL |
| External API outage (TMDB) | Stale data | N/A | MCP retry/backoff; serve cached data |

## DR Drill Schedule

| Drill | Frequency | Scope |
|-------|-----------|-------|
| PostgreSQL restore | Quarterly | Restore pg_dump to test instance, verify data |
| Full DR | Semi-annually | Restore all components to clean environment |
| Runbook walkthrough | Quarterly | Team reviews runbooks, updates as needed |
| Backup verification | Monthly | Verify backups exist and are not corrupted |
