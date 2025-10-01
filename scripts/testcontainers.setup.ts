import { afterAll, beforeAll } from 'vitest';
import { StartedPostgreSqlContainer, PostgreSqlContainer } from '@testcontainers/postgresql';
import { StartedRedisContainer, RedisContainer } from '@testcontainers/redis';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { exec as _exec } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(_exec);

let pg: StartedPostgreSqlContainer | undefined;
let redis: StartedRedisContainer | undefined;
let os: StartedTestContainer | undefined;

beforeAll(async () => {
  try {
    // Start Postgres
    pg = await new PostgreSqlContainer('postgres:16')
      .withDatabase('w2w')
      .withUsername('w2w')
      .withPassword('w2w')
      .start();
    process.env.DATABASE_URL = `postgresql://${pg.getUsername()}:${pg.getPassword()}@${pg.getHost()}:${pg.getPort()}/${pg.getDatabase()}?schema=public`;

    // Start Redis
    redis = await new RedisContainer('redis:7').start();
    process.env.REDIS_URL = `redis://${redis.getHost()}:${redis.getPort()}`;

    // Start OpenSearch (optional; most tests stub OS). If it fails, continue.
    try {
      // GenericContainer typing varies; use withEnvironment for compatibility
      const osContainer = await new GenericContainer('opensearchproject/opensearch:2.14.0')
        .withEnvironment({
          'discovery.type': 'single-node',
          'plugins.security.disabled': 'true',
          OPENSEARCH_JAVA_OPTS: '-Xms256m -Xmx256m',
        })
        .withExposedPorts(9200)
        .withWaitStrategy(Wait.forLogMessage('Node started'))
        .start();
      os = osContainer;
      process.env.OPENSEARCH_URL = `http://${osContainer.getHost()}:${osContainer.getMappedPort(9200)}`;
    } catch (error) {
      // Best-effort only
      // eslint-disable-next-line no-console
      console.warn('[testcontainers] OpenSearch not started (continuing):', String(error));
    }

    // Apply schema to container DB
    await exec('node -r ./scripts/load-env.cjs scripts/require-venv.cjs && prisma db push');
  } catch (error) {
    // Soft-fail to DB-less mode
    // eslint-disable-next-line no-console
    console.warn('[testcontainers] Disabled (continuing without containers):', String(error));
    try {
      await pg?.stop();
    } catch {
      // ignore
    }
    try {
      await redis?.stop();
    } catch {
      // ignore
    }
    try {
      await os?.stop();
    } catch {
      // ignore
    }
    pg = undefined;
    redis = undefined;
    os = undefined;
  }
}, 120_000);

afterAll(async () => {
  try {
    await pg?.stop();
  } catch {
    // ignore
  }
  try {
    await redis?.stop();
  } catch {
    // ignore
  }
  try {
    await os?.stop();
  } catch {
    // ignore
  }
});
