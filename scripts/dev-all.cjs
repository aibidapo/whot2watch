#!/usr/bin/env node
/*
  Dev orchestrator: spins up infra, prepares DB, (optionally) ingests+indexes,
  then starts API and Web concurrently.
  Usage:
    node -r ./scripts/load-env.cjs scripts/dev-all.cjs [--skip-ingest] [--sample]
  Control:
    node -r ./scripts/load-env.cjs scripts/dev-all.cjs --down     # stop dev stack
    node -r ./scripts/load-env.cjs scripts/dev-all.cjs --restart  # down then up
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
const DO_DOWN = argv.includes('--down');
const DO_RESTART = argv.includes('--restart');

// 0) Enforce venv
log('Checking Python venv');
sh('node scripts/require-venv.cjs');

function down() {
  log('Stopping Docker services');
  if (!trySh('docker compose down')) {
    trySh('docker-compose down');
  }
  log('Killing dev ports');
  try {
    trySh('npx --yes kill-port 4000 3000 3001 3002');
  } catch {}
}

if (DO_DOWN) {
  down();
  process.exit(0);
}

if (DO_RESTART) {
  down();
}

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
    log('Ingesting Trakt trending (week)');
    trySh('pnpm ingest:trakt');
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
    // Force Next.js to bind to web port (avoid inheriting PORT=4000 from .env)
    PORT: process.env.WEB_PORT || '3000',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    NEXT_PUBLIC_DEFAULT_PROFILE_ID: process.env.NEXT_PUBLIC_DEFAULT_PROFILE_ID || '',
    NEXT_PUBLIC_DEFAULT_REGIONS:
      process.env.NEXT_PUBLIC_DEFAULT_REGIONS || process.env.DEFAULT_REGIONS || 'US',
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
