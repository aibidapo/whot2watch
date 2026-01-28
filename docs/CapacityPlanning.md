# Capacity Planning

## Current Baseline (k6 Load Tests)

| Scenario | VUs | P95 Latency | P99 Latency | Threshold |
|----------|-----|-------------|-------------|-----------|
| Smoke | 1 | < 200 ms | < 400 ms | Pass |
| Load | 50 | < 600 ms | < 1500 ms | P95 < 600 ms |
| Stress | 200 | < 1500 ms | < 2000 ms | Find breaking points |
| Chat | 10 | < 3000 ms | < 5000 ms | P95 < 3000 ms |

## Resource Profiles

| Component | CPU (idle) | CPU (50 VU) | Memory (idle) | Memory (50 VU) | Storage |
|-----------|-----------|-------------|---------------|----------------|---------|
| API (Fastify) | 0.1 core | 0.5 core | 128 MB | 256 MB | N/A |
| PostgreSQL | 0.1 core | 0.3 core | 256 MB | 512 MB | 2 GB/100K titles |
| OpenSearch | 0.2 core | 0.5 core | 512 MB | 1 GB | 1 GB/100K titles |
| Redis | 0.05 core | 0.1 core | 64 MB | 128 MB | < 100 MB |

## Scaling Triggers

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| API P95 latency | > 400 ms | > 600 ms | Scale API replicas horizontally |
| DB connection pool usage | > 70% | > 90% | Increase pool size or add read replica |
| OpenSearch heap | > 70% | > 85% | Scale OpenSearch nodes or increase heap |
| Redis memory | > 70% | > 90% | Increase memory limit or add eviction policy |
| Disk usage (any) | > 70% | > 85% | Expand volume |

## Scaling Actions

### Horizontal (preferred)
- API: stateless, scale behind load balancer (2-4 replicas per 100 concurrent users)
- OpenSearch: add data nodes for index sharding

### Vertical
- PostgreSQL: increase instance size before adding read replicas
- Redis: increase memory allocation

### Data Growth Estimates
- Titles: ~500K total (stable, grows ~1K/month from new releases)
- Users: plan for 10x current active users per quarter
- Analytics events: ~100 events/user/day, buffered and flushed to webhook

## Load Test Schedule

| Test | Frequency | Trigger |
|------|-----------|---------|
| Smoke (1 VU) | Every CI run | Push/PR to main |
| Load (50 VU) | Weekly | Scheduled CI |
| Stress (200 VU) | Monthly | Manual dispatch |
| Chat (10 VU) | Weekly | Scheduled CI |
