# NERS — Named Entity Responsibility Sheet

Module ownership mapping for the Whot2Watch monorepo. Each module has a designated owner team responsible for reviews, on-call, and architectural decisions.

## Module Ownership

| Module | Path | Owner | Responsibilities |
|--------|------|-------|-----------------|
| Web App | `apps/web/` | Frontend team | Next.js UI, pages, components, PWA, SEO |
| Mobile App | `apps/mobile/` | Mobile team | React Native app (when created) |
| API Server | `server/` | Platform team | Fastify routes, auth, analytics, GraphQL |
| AI Agents | `server/agents/`, `server/mcp/` | AI team | Orchestrator, workers, MCP tools, LLM integration |
| Catalog Services | `services/catalog/` | Data team | TMDB/OMDB/Trakt ingestion, indexing, enrichment |
| Shared Types | `packages/types/` | Platform team | OpenAPI/GraphQL generated types, shared interfaces |
| UI Components | `packages/ui/` | Frontend team | Shared React components (when created) |
| Documentation | `Whot2Watch-docs/` | Platform team | OpenAPI, GraphQL schema, ERD, ADRs |
| Infrastructure | `prisma/`, `docker-compose.yml` | Infra team | Database schema, migrations, container setup |

## Ownership Rules

1. **PR reviews**: At least one reviewer from the owning team must approve changes to their module.
2. **Cross-module changes**: PRs touching multiple modules require one reviewer from each affected team.
3. **Schema changes** (`prisma/schema.prisma`): Require review from both the Infra team and the team requesting the change.
4. **Contract changes** (`Whot2Watch-docs/`): Require review from the Platform team and any team whose API surface is affected.
5. **Dependency updates**: Owner team reviews and tests within their module scope.

## CODEOWNERS Template

The following can be placed in `.github/CODEOWNERS` once GitHub team handles are established:

```
# Default — platform team
*                           @org/platform

# Frontend
apps/web/                   @org/frontend

# Mobile
apps/mobile/                @org/mobile

# API & Auth
server/                     @org/platform

# AI / MCP
server/agents/              @org/ai
server/mcp/                 @org/ai

# Data Pipeline
services/catalog/           @org/data

# Shared Packages
packages/types/             @org/platform
packages/ui/                @org/frontend

# Documentation & Contracts
Whot2Watch-docs/            @org/platform

# Infrastructure
prisma/                     @org/infra
docker-compose.yml          @org/infra
.github/workflows/          @org/infra @org/platform
```

> **Note**: Replace `@org/team` with actual GitHub team handles when the organization is set up.
