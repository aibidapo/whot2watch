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

// Proactively free commonly used dev ports to avoid file locks (Prisma engine DLL) and EADDRINUSE
try {
  trySh('npx --yes kill-port 4000 3000 3001 3002');
} catch {}

// 2) DB
log('Prisma generate/migrate/seed');
sh('pnpm prisma:generate');
// clear CI to allow interactive migrate dev if needed
sh('pnpm prisma:migrate:dev', { CI: '' });
sh('pnpm db:seed');

// 3) Ingest + Index + Ratings enrichment
if (!SKIP_INGEST) {
  if (USE_SAMPLE) {
    log('Indexing sample docs into OpenSearch');
    sh('pnpm index:sample');
  } else {
    log('Running TMDB ingest');
    sh('pnpm ingest:tmdb');
    log('Backfilling missing imdbId via TMDB external_ids');
    sh('node -r ./scripts/load-env.cjs services/catalog/backfillImdbIds.js');
    log('Ingesting OMDb ratings');
    sh('node -r ./scripts/load-env.cjs services/catalog/ingestOmdbRatings.js');
    log('Ingesting TMDB watch providers');
    sh('pnpm ingest:providers');
    log('Ingesting TMDB trending (day/week)');
    sh('pnpm ingest:trending');
    log('Indexing from DB to OpenSearch');
    sh('pnpm index:fromdb');
  }
}

// 4) Start API and Web
log('Starting API and Web');
const api = spawn('pnpm', ['api:dev'], { stdio: 'inherit', shell: true });
const web = spawn('pnpm', ['web:dev'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    NEXT_PUBLIC_DEFAULT_PROFILE_ID: process.env.NEXT_PUBLIC_DEFAULT_PROFILE_ID || '',
    // Do not force PORT so Next can auto-select a free port
  },
});

function cleanup() {
  try {
    api.kill('SIGINT');
  } catch {}
  try {
    web.kill('SIGINT');
  } catch {}
  process.exit(0);
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
