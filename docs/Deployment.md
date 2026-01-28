# Deployment Guide — What2Watch

## Environments

| Environment | URL | Branch | Auto-deploy | Approval |
|-------------|-----|--------|-------------|----------|
| CI | — | All PRs + `main` | Yes | None |
| Staging | `staging.whot2watch.dev` | `main` | Yes (on CI pass) | None |
| Production | `whot2watch.dev` | `main` | No | Manual approval (2 reviewers) |

## Deployment Flow

```
PR merge → main branch → CI pipeline → Staging deploy → Manual approval → Production deploy
```

1. **PR merge to `main`**: Triggers CI workflow (`ci.yml`)
2. **CI pipeline**: Runs all quality gates (lint, typecheck, contracts, coverage, audit, secret scan)
3. **Staging deploy**: On CI success, automatically deploys to staging environment
   - Runs database migrations (`prisma migrate deploy`)
   - Deploys API and frontend containers
   - Runs smoke tests against staging
4. **Manual approval**: Requires 2 reviewer approvals in GitHub Environment protection rules
5. **Production deploy**: After approval, deploys to production
   - Runs database migrations
   - Rolling deployment (zero-downtime)
   - Post-deploy health check (`/healthz`)

## Rollback Procedures

### Application Rollback

1. **Revert commit**: Create a revert PR for the problematic change
2. **Fast rollback**: Re-deploy previous container image tag via workflow dispatch
3. **Verify**: Confirm `/healthz` returns `ok` and key flows work

### Database Migration Rollback

1. Prisma migrations are forward-only by default
2. For breaking schema changes, create a new migration that reverses the change
3. Ensure application code handles both old and new schemas during rollback window
4. Never use `prisma migrate reset` in production

### Feature Flag Rollback

1. Disable the feature flag (`AI_CONCIERGE_ENABLED`, `NLU_ENABLED`, `SOCIAL_FEED_ENABLED`)
2. Flags are read from environment variables; update in GitHub Environment secrets
3. Restart the service to pick up new flag values (or use dynamic config if available)

## CI/CD Workflow Summary

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push to `main`, PRs | Full quality gates, tests, contract validation |
| `ci-security.yml` | Weekly schedule, manual dispatch | ZAP security baseline scan |
| `nightly-mutation.yml` | Daily 05:00 UTC | Stryker mutation testing |

## Pre-deployment Checklist

- [ ] All CI checks pass (green)
- [ ] No critical `npm audit` findings
- [ ] Database migrations reviewed (if any)
- [ ] Feature flags configured for the target environment
- [ ] ROADMAP items updated for the changes
- [ ] Rollback plan documented for risky changes
