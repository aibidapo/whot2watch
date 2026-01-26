# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Whot2Watch is an entertainment discovery platform helping users find movies/TV shows on their streaming services. Monorepo structure:

- **Backend API** (`server/api.ts`): Fastify REST/GraphQL server (port 4000), ~1900 lines, handles search, picks, analytics, admin, profiles, auth
- **AI Agents** (`server/agents/`, `server/mcp/`): MCP-based orchestrator-workers architecture for AI Concierge (Epic 8)
- **Frontend** (`apps/web/`): Next.js 15.5 web app (port 3000)
- **Catalog Services** (`services/catalog/`): Data ingestion pipelines (TMDB, OMDB, JustWatch, Trakt)
- **Infrastructure**: PostgreSQL (Prisma ORM), OpenSearch (title indexing), Redis (analytics buffering, session state)

## Common Commands

**Prerequisites**: Node 20+, pnpm 10.17+, Docker. Python venv must be activated:
- PowerShell: `.\.venv\Scripts\Activate.ps1`
- bash/zsh: `source .venv/bin/activate`

```bash
# Development
docker compose up -d                 # Postgres, Redis, OpenSearch, Dashboards
pnpm api:dev                         # API server (localhost:4000)
pnpm web:dev                         # Next.js frontend (localhost:3000)
pnpm dev:all                         # All services in parallel (supports --down, --restart, --skip-ingest, --sample)

# Quality Gates
pnpm qa                              # ALL gates: format, lint, typecheck, contracts, coverage, jscpd, gitleaks, depcruise, deadcode
pnpm lint                            # ESLint (zero warnings required)
pnpm typecheck                       # TypeScript strict mode
pnpm contracts:check                 # Validate OpenAPI + GraphQL + Mermaid ERD
pnpm coverage                        # Vitest coverage (80% threshold: lines, branches, functions, statements)

# Testing
pnpm test                            # Vitest watch mode
pnpm test:ci                         # Vitest single run
vitest server/api.test.ts            # Run single test file
vitest -t "pattern"                  # Run tests matching name pattern
pnpm test:int                        # Integration tests (testcontainers: Postgres + Redis)

# Code Generation
pnpm gen:graphql                     # GraphQL → TypeScript types
pnpm gen:openapi                     # OpenAPI → TypeScript types
pnpm prisma:generate                 # Prisma client

# Database
pnpm prisma:migrate:dev              # Create & run dev migrations
pnpm db:seed                         # Seed sample data

# Data Pipeline
pnpm pipeline:ingest-index           # Full ingest-to-index
pnpm pipeline:nightly                # Nightly enrichment (ratings, providers, trending, reindex)
```

## Architecture

### Data Flow

```
TMDB/OMDB APIs → Prisma → PostgreSQL → OpenSearch (indexing)
                                     → Fastify API → Next.js Frontend
                                     → Analytics → Redis buffer → webhook
```

### MCP Agent Architecture (Epic 8)

```
User Query → POST /v1/chat → Orchestrator Agent → Worker Agents → MCP Tools / Local DB → Response
```

- **Orchestrator** (`server/agents/orchestrator.ts`): Classifies intent, routes to workers, aggregates responses
- **Workers** (`server/agents/workers/`): Search, Availability, Preferences, Recommendations
- **MCP Layer** (`server/mcp/`): TMDB and JustWatch MCP servers with caching, backoff, lazy loading
- **Context** (`server/agents/context.ts`): Redis-backed conversation sessions with TTL
- **Config** (`server/agents/config.ts`): Feature flags, LLM provider selection, cost controls, safety filters

Feature flags: `AI_CONCIERGE_ENABLED`, `NLU_ENABLED`, `SOCIAL_FEED_ENABLED`

LLM provider chain: Anthropic → OpenAI → NLU rules (fallback)

### Key Entry Points

| Path | Purpose |
|------|---------|
| `server/api.ts` | Main REST/GraphQL API (all routes) |
| `server/agents/types.ts` | Agent/MCP type definitions |
| `server/mcp/client.ts` | MCP client singleton (caching + exponential backoff) |
| `prisma/schema.prisma` | Database schema (source of truth) |
| `Whot2Watch-docs/docs/rest/openapi.yaml` | REST API contract |
| `Whot2Watch-docs/docs/graphql/schema.graphql` | GraphQL contract |
| `services/catalog/worker.ingest.js` | Data pipeline orchestrator |

### Database Entities

Core Prisma models: User, Profile, Title, Availability, Subscription, List, ListItem, Feedback, Alert, Friend, GroupSession, Vote, Recommendation, TrendingSignal, ExternalRating

## Contract-First Development

API contracts in `Whot2Watch-docs/` are the source of truth. Edit contracts first, then implement code.

- **REST**: `Whot2Watch-docs/docs/rest/openapi.yaml` — remove TODOs before PR
- **GraphQL**: `Whot2Watch-docs/docs/graphql/schema.graphql`
- **ERD**: `Whot2Watch-docs/docs/ERD.mmd`
- **Analytics Events**: `whot2watch-docs/docs/analytics/events/` — JSON Schema per event

Validate: `pnpm contracts:check`

## ROADMAP Tracking

Any code or contract change **must** include corresponding updates in `ROADMAP/`. CI and pre-push will fail otherwise. Map each checklist item to a GitHub issue labeled by epic. See `ROADMAP/README.md` for the full epic index.

ADRs live in `docs/adr/` following the template in `docs/adr/0000-template.md`.

## Environment Setup

Copy `.env.example` to `.env.local`. Minimum required:
```
DATABASE_URL=postgresql://w2w:w2w@localhost:5432/w2w
REDIS_URL=redis://localhost:6379
OPENSEARCH_URL=http://localhost:9200
```

AI/MCP variables (see `.env.example` for full list):
- `AI_CONCIERGE_ENABLED`, `NLU_ENABLED`, `SOCIAL_FEED_ENABLED` — feature flags
- `LLM_PROVIDER` (anthropic/openai/none), `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
- `LLM_DAILY_LIMIT_FREE=10`, `LLM_DAILY_LIMIT_PREMIUM=1000` — cost controls
- `AVAILABILITY_SOURCE` (LOCAL/TMDB/JUSTWATCH/WATCHMODE) — data source selection

## TypeScript & Code Style

- Strict mode with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`
- Target: ES2022, Module: ESNext, Resolution: Bundler
- Logger: `server/common/logger.ts` — auto-redacts sensitive keys (auth, token, secret, password)
- Services are optional: Redis, OpenSearch gracefully degrade when unavailable
- Test containers: set `TEST_WITH_CONTAINERS=true` for Postgres+Redis integration tests

## CI/CD

- Pre-commit: format, lint, typecheck
- Pre-push: contracts validation, coverage ≥ 80%
- CI: all gates + GraphQL breaking changes + Prisma drift + gitleaks

## Windows/PowerShell Note

`curl` is aliased to `Invoke-WebRequest`. Use `Invoke-RestMethod` for JSON responses:
```powershell
Invoke-RestMethod -Method GET http://localhost:9200/titles/_count
```
