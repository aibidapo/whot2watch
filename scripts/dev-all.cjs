#!/usr/bin/env node
/*
  Dev orchestrator: spins up infra, prepares DB, (optionally) ingests+indexes,
  then starts API and Web concurrently.
  Usage:
    node -r ./scripts/load-env.cjs scripts/dev-all.cjs [--skip-ingest] [--sample]
*/
const { execSync, spawn } = require('child_process');

function sh(cmd, env = {}) {
  execSync(cmd, { stdio: 'inherit', shell: true, env: { ...process.env, ...env } });
}

function trySh(cmd) {
  try {
    sh(cmd);
    return true;
  } catch {
    return false;
  }
}

function log(step) {
  console.log(`\n=== ${step} ===`);
}

const argv = process.argv.slice(2);
const SKIP_INGEST = argv.includes('--skip-ingest');
const USE_SAMPLE = argv.includes('--sample');

// 0) Enforce venv
log('Checking Python venv');
sh('node scripts/require-venv.cjs');

// 1) Infra
log('Starting Docker services (postgres, redis, opensearch, dashboards)');
if (!trySh('docker compose up -d postgres redis opensearch dashboards')) {
  sh('docker-compose up -d postgres redis opensearch dashboards');
}

// 2) DB
log('Prisma generate/migrate/seed');
sh('pnpm prisma:generate');
// clear CI to allow interactive migrate dev if needed
sh('pnpm prisma:migrate:dev', { CI: '' });
sh('pnpm db:seed');

// 3) Ingest + Index
if (!SKIP_INGEST) {
  log(USE_SAMPLE ? 'Indexing sample docs into OpenSearch' : 'Running ingest + index pipeline');
  if (USE_SAMPLE) {
    sh('pnpm index:sample');
  } else {
    sh('pnpm pipeline:ingest-index');
  }
}

// 4) Start API and Web
log('Starting API and Web');
const api = spawn('pnpm', ['api:dev'], { stdio: 'inherit', shell: true });
const web = spawn('pnpm', ['web:dev'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000' },
});

function cleanup() {
  try { api.kill('SIGINT'); } catch {}
  try { web.kill('SIGINT'); } catch {}
  process.exit(0);
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);


