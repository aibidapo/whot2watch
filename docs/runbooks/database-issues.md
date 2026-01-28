# Runbook: Database Issues

## Trigger
- Database connection failures in application logs
- Slow queries causing latency spikes
- Migration failures in CI/CD
- Deadlock errors

## Common Scenarios

### Connection Pool Exhaustion

**Symptoms**: `PrismaClientKnownRequestError: Can't reach database server` or connection timeout errors.

**Investigation**:
1. Check current connections: `SELECT count(*) FROM pg_stat_activity WHERE datname = 'w2w';`
2. Check for idle-in-transaction connections: `SELECT * FROM pg_stat_activity WHERE state = 'idle in transaction' AND query_start < NOW() - INTERVAL '5 minutes';`

**Resolution**:
- Restart API to release stale connections
- Increase `connection_limit` in Prisma connection string
- Kill idle-in-transaction connections if safe

### Migration Failures

**Symptoms**: `pnpm prisma:migrate:deploy` fails in CI.

**Investigation**:
1. Check migration status: `SELECT * FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5;`
2. Look for failed migrations (null `finished_at`, non-null `rolled_back_at`)
3. Run schema drift check: `npx prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script`

**Resolution**:
- Fix the migration SQL and re-run
- If stuck, mark failed migration as rolled back and create a corrective migration
- Never manually edit `_prisma_migrations` in production without approval

### Deadlocks

**Symptoms**: `deadlock detected` errors in logs.

**Investigation**:
1. Check for deadlocks: `SELECT * FROM pg_locks WHERE NOT granted;`
2. Identify conflicting transactions from application logs
3. Review the access patterns causing the deadlock

**Resolution**:
- Ensure consistent lock ordering in application code
- Add retry logic for deadlock-prone operations
- Consider advisory locks for critical sections

### Backup Verification

**Schedule**: Monthly (see [Disaster Recovery](../DisasterRecovery.md))

1. Verify latest pg_dump exists and is not corrupted
2. Restore to test instance: `pg_restore -d w2w_test latest.dump`
3. Run row count spot checks against production
4. Run `pnpm prisma:migrate:deploy` on restored DB to verify schema

## Escalation
- Connection pool exhaustion lasting > 10 minutes: escalate immediately
- Data corruption suspected: stop writes, escalate to DBA
