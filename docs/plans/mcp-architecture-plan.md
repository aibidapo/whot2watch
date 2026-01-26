# Whot2Watch MCP/Agentic Architecture Implementation Plan

## Overview

This plan implements **Epic 8 — AI & Social** using an MCP (Model Context Protocol) based architecture with the **Orchestrator-Workers** pattern. It maintains backward compatibility with existing REST API while adding a conversational discovery layer.

**Cross-Epic Alignment:**

| Epic | Requirements Addressed |
|------|------------------------|
| **Epic 0** | ADR requirement, HTTP caching/backoff for MCP, feature flags |
| **Epic 1** | MCP complements (not replaces) ingestion; respects `AVAILABILITY_SOURCE` |
| **Epic 2** | Admin refresh via MCP; API versioning; cache strategy |
| **Epic 3** | Mobile AI chat screen (shared backend, mobile-specific notes) |
| **Epic 4** | Web concierge UI (chat drawer + search bar augment) |
| **Epic 5** | Analytics schema for AI events; dashboard integration |
| **Epic 6** | Load testing for chat; security testing; MCP fallback E2E |
| **Epic 8** | AI Concierge MVP, NLU fallback, safety filters, cost controls |
| **Epic 9** | Freemium gating for AI; plan-tier usage limits |
| **Epic 12** | LLM cost monitoring; chat scaling strategy |

**Feature Flags (from Epic 8):**
- `AI_CONCIERGE_ENABLED` - Enable/disable chat endpoint
- `NLU_ENABLED` - Enable/disable NLU parsing (fallback to filters)
- `SOCIAL_FEED_ENABLED` - Enable social context in chat

---

## Cross-Epic Integration Requirements

### Epic 0: Foundations
- **HTTP Caching/Backoff** (incomplete item): Apply to MCP client for rate limiting, retry logic
- **Feature Flag Infrastructure**: Use existing flag pattern for `AI_CONCIERGE_ENABLED`
- **ADR Requirement**: Create `docs/adr/0002-mcp-agentic-architecture.md`

### Epic 1: Data Model & Ingestion
- **MCP Complements Ingestion**: MCP servers provide real-time queries; existing ingestion populates local DB
- **Respect `AVAILABILITY_SOURCE`**: When `AVAILABILITY_SOURCE=TMDB`, use local DB; when external, use MCP
- **Hybrid Strategy**:
  - Real-time lookups → MCP (trending, availability checks)
  - Bulk ingestion → Existing scripts (nightly refresh)
  - User data → Always local Prisma

### Epic 2: Backend API
- **Admin Refresh + MCP**: `/v1/admin/refresh` can optionally use MCP for immediate data
- **APM for Chat**: Add latency/error tracking for `/v1/chat` endpoint
- **Cache Strategy**: Redis caching for MCP responses; invalidation on admin refresh

### Epic 3: Mobile App
- **Shared Backend**: Same `/v1/chat` endpoint serves mobile
- **Mobile Notes**:
  - React Native chat component guidance (not in scope for this plan)
  - Feature flag respects mobile client headers

### Epic 4: Web Companion
- **Search Bar Augment**: Add NLU parsing to existing search input (not just drawer)
- **Chat Drawer**: Floating ChatPanel as designed
- **PWA/SEO**: Chat responses not indexed; lazy-load chat component

### Epic 5: Alerts & Analytics
- **AI Event Schema**: Define analytics events for chat interactions:
  - `chat_message_sent`, `chat_response_received`, `chat_fallback_triggered`
  - `llm_request_count`, `llm_tokens_used`, `llm_cost_estimate`
- **Dashboard Integration**: Add AI panel to existing analytics dashboards

### Epic 6: Testing & Security
- **Load Testing**: k6 scenarios for `/v1/chat` (target P95 < 3s)
- **Security Testing**: Include `/v1/chat` in ZAP scan; input sanitization
- **MCP Fallback E2E**: Test graceful degradation when MCP servers unavailable

### Epic 8: AI & Social (Primary)
- **Cold-Start Integration**: Chat worker reads taste chips from onboarding
- **LLM Provider Selection**:
  - Default: Anthropic Claude (via MCP)
  - Fallback: OpenAI GPT-4
  - Cost fallback: Rules-based NLU (no LLM)
- **Safety Filters**:
  - Input: Block prompt injection patterns
  - Output: Content filter for unsafe responses
  - Logging: Redact prompts; store hashed versions only
- **Social in Chat**: When `SOCIAL_FEED_ENABLED`, include friends' recent picks in context

### Epic 9: Monetization
- **Freemium Gating**:
  - Free tier: 10 chat messages/day
  - Premium: Unlimited + priority response
- **Plan Enforcement**: Server-side check before LLM call

### Epic 12: Operations
- **LLM Cost Monitoring**: Track tokens per user; daily/monthly aggregates
- **Budget Caps**: Per-user daily limit; global monthly budget alert
- **Scaling**: Chat endpoint horizontally scalable; Redis for session state

---

## Documentation Deliverables

### 1. ADR (Architecture Decision Record)
**Created:** `docs/adr/0002-mcp-agentic-architecture.md`

### 2. ROADMAP Update
**Modified:** `ROADMAP/08-AI-and-Social.md` — MCP Architecture checklist added

### 3. OpenAPI Spec Update
**Pending:** `Whot2Watch-docs/docs/rest/openapi.yaml` — Add /v1/chat endpoints

---

## Architecture Design

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                           │
│         [Existing Pages] + [NEW: ChatPanel Component]           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
┌───────────────────┐                   ┌───────────────────────┐
│  Existing REST    │                   │  NEW: /v1/chat        │
│  /search, /picks  │                   │  POST + SSE streaming │
│  /lists, etc.     │                   └───────────┬───────────┘
└───────────────────┘                               │
                                                    ▼
                              ┌─────────────────────────────────────┐
                              │         ORCHESTRATOR AGENT          │
                              │  - Intent classification            │
                              │  - Worker routing                   │
                              │  - Response aggregation             │
                              └──────┬──────┬──────┬──────┬────────┘
                                     │      │      │      │
                    ┌────────────────┼──────┼──────┼──────┼────────┐
                    ▼                ▼      ▼      ▼      ▼        │
              ┌──────────┐    ┌──────────┐ ┌──────────┐ ┌──────────┐
              │  Search  │    │ Avail-   │ │  Prefs   │ │  Recs    │
              │  Worker  │    │ ability  │ │  Worker  │ │  Worker  │
              └────┬─────┘    └────┬─────┘ └────┬─────┘ └────┬─────┘
                   │               │            │            │
        ┌──────────┴───────────────┴────────────┴────────────┘
        │                    MCP LAYER
        ▼                        ▼                    ▼
┌──────────────┐      ┌──────────────────┐    ┌────────────┐
│  TMDB MCP    │      │  JustWatch MCP   │    │ PostgreSQL │
│  Server      │      │  Server          │    │ (Prisma)   │
└──────────────┘      └──────────────────┘    └────────────┘
```

---

## Project Structure (New Files)

```
server/
├── agents/
│   ├── orchestrator.ts         # Central orchestration
│   ├── context.ts              # Conversation state (Redis-backed)
│   ├── types.ts                # Agent interfaces
│   ├── config.ts               # Feature flags, LLM config, cost controls
│   └── workers/
│       ├── search.worker.ts    # NL → OpenSearch/TMDB MCP
│       ├── availability.worker.ts  # JustWatch/Watchmode MCP
│       ├── preferences.worker.ts   # User prefs from Prisma
│       └── recommendations.worker.ts # Scoring + diversity
├── mcp/
│   ├── client.ts               # MCP SDK wrapper
│   ├── registry.ts             # Progressive tool discovery
│   └── adapters/
│       ├── tmdb.adapter.ts     # TMDB MCP integration
│       └── justwatch.adapter.ts # JustWatch MCP integration
└── chat/
    ├── router.ts               # POST /v1/chat + GET /v1/chat/stream
    ├── session.ts              # Session management
    └── streaming.ts            # SSE implementation

apps/web/src/components/chat/
├── ChatPanel.tsx               # Floating chat widget
├── ChatMessage.tsx             # Message bubbles + title cards
├── ChatInput.tsx               # Input with suggestions
└── hooks/
    └── useChat.ts              # Chat state + streaming

docs/adr/
└── 0002-mcp-agentic-architecture.md  # Architecture decision

.mcp.json                       # MCP server configuration
```

---

## Implementation Phases

### Phase 1: Foundation & Documentation (Week 1-2)
**Goal**: Infrastructure setup, ADR, no user-facing changes

| Task | Files | Tracking |
|------|-------|----------|
| Create ADR document | `docs/adr/0002-mcp-agentic-architecture.md` | Epic 0/8 |
| Update ROADMAP checklist | `ROADMAP/08-AI-and-Social.md` | Epic 8 |
| Create directory structure | `server/agents/`, `server/mcp/`, `server/chat/` | Epic 8 |
| Add dependencies | `package.json` (+@modelcontextprotocol/sdk, zod) | Epic 0 |
| Agent type definitions | `server/agents/types.ts` | Epic 8 |
| MCP client with caching/backoff | `server/mcp/client.ts` | Epic 0/8 |
| Conversation context (Redis) | `server/agents/context.ts` | Epic 8 |
| Feature flag config | `server/agents/config.ts` | Epic 0/8 |
| AI analytics event schema | `whot2watch-docs/docs/analytics/events/` | Epic 5 |

### Phase 2: Worker Agents (Week 3-4)
**Goal**: Implement specialist workers using existing infrastructure

| Task | Files | Tracking |
|------|-------|----------|
| Search worker | `server/agents/workers/search.worker.ts` | Epic 8 |
| Availability worker | `server/agents/workers/availability.worker.ts` | Epic 8 |
| Preferences worker | `server/agents/workers/preferences.worker.ts` | Epic 8 |
| Recommendations worker | `server/agents/workers/recommendations.worker.ts` | Epic 8 |
| Worker unit tests | `server/agents/workers/*.test.ts` | Epic 6 |

**Key**: Workers reuse existing logic from `server/api.ts`:
- Search: lines 690-1001 (OpenSearch query building)
- Picks: lines 1423-1848 (scoring, diversity, reasons)

### Phase 3: MCP Integration (Week 5-6)
**Goal**: Connect external MCP servers

| Task | Files | Tracking |
|------|-------|----------|
| MCP configuration | `.mcp.json` | Epic 8 |
| TMDB adapter | `server/mcp/adapters/tmdb.adapter.ts` | Epic 1/8 |
| JustWatch adapter | `server/mcp/adapters/justwatch.adapter.ts` | Epic 1/8 |
| Progressive discovery | `server/mcp/registry.ts` | Epic 8 |
| Integration tests | `server/mcp/**/*.test.ts` | Epic 6 |

### Phase 4: Orchestrator + Chat API (Week 7-9) ✅
**Goal**: Central agent and new API endpoint

| Task | Files | Tracking | Status |
|------|-------|----------|--------|
| Orchestrator implementation | `server/agents/orchestrator.ts` | Epic 8 | ✅ |
| Chat router (REST + SSE) | `server/chat/router.ts` | Epic 2/8 | ✅ |
| Session management | `server/chat/session.ts` | Epic 8 | ✅ |
| Register routes in api.ts | `server/api.ts` (modify) | Epic 2 | ✅ |
| Orchestrator tests | `server/agents/orchestrator.test.ts` | Epic 6 | ✅ (29 tests) |
| Chat endpoint tests | `server/chat/router.test.ts` | Epic 6 | ✅ (12 tests) |
| OpenAPI spec update | `Whot2Watch-docs/docs/rest/openapi.yaml` | Epic 2 | Deferred |

### Phase 5: Frontend Integration (Week 10-11)
**Goal**: Chat UI in Next.js app

| Task | Files | Tracking |
|------|-------|----------|
| useChat hook | `apps/web/src/components/chat/hooks/useChat.ts` | Epic 4/8 |
| ChatPanel component | `apps/web/src/components/chat/ChatPanel.tsx` | Epic 4/8 |
| ChatMessage component | `apps/web/src/components/chat/ChatMessage.tsx` | Epic 4 |
| ChatInput component | `apps/web/src/components/chat/ChatInput.tsx` | Epic 4 |
| Layout integration | `apps/web/src/app/layout.tsx` (modify) | Epic 4 |
| Component tests | `apps/web/src/components/chat/*.test.tsx` | Epic 6 |

### Phase 6: Production Hardening (Week 12)
**Goal**: Rate limiting, caching, monitoring per Epic 8 requirements

| Task | Files | Tracking |
|------|-------|----------|
| Chat rate limiting (per-user/day) | `server/chat/router.ts` | Epic 8 |
| Freemium plan gating | `server/chat/router.ts` | Epic 9 |
| LLM cost controls & budget caps | `server/agents/config.ts` | Epic 8/12 |
| LLM cost monitoring/dashboards | `server/agents/telemetry.ts` | Epic 12 |
| Safety filters on inputs/outputs | `server/agents/safety.ts` | Epic 8 |
| Prompt redaction (hashed logging) | `server/agents/safety.ts` | Epic 8 |
| Feature flag gating | `server/agents/config.ts` | Epic 8 |
| Analytics events (AI usage telemetry) | `server/chat/router.ts` | Epic 5/8 |
| APM integration for /v1/chat | `server/chat/router.ts` | Epic 2/12 |
| Load test scenarios (k6) | `scripts/load-tests/chat.k6.js` | Epic 6 |
| ZAP scan configuration | `.zap/chat-scan.yaml` | Epic 6 |

### Phase 7: Mobile Integration (Week 13 - Optional)
**Goal**: Enable AI chat in mobile app (Epic 3)

| Task | Files | Tracking |
|------|-------|----------|
| Mobile chat component guidance | `docs/mobile-chat-integration.md` | Epic 3 |
| Verify mobile headers for feature flags | `server/chat/router.ts` | Epic 3 |
| Mobile-specific rate limits | `server/chat/router.ts` | Epic 3 |

**Note**: Mobile UI implementation is out of scope; this phase ensures backend supports mobile clients.

---

## MCP Configuration (.mcp.json)

```json
{
  "mcpServers": {
    "tmdb": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-tmdb"],
      "env": { "TMDB_API_KEY": "${TMDB_API_KEY}" },
      "lazyLoad": true
    },
    "justwatch": {
      "command": "uvx",
      "args": ["mcp-justwatch"],
      "lazyLoad": true
    }
  }
}
```

---

## Key API Additions

### POST /v1/chat (maps to /ai/concierge from Epic 8)
```typescript
Request: {
  sessionId?: string,
  message: string,
  profileId?: string,
  context?: object  // Optional conversation context
}
Response: {
  sessionId: string,
  recommendations: Title[],
  reasoning: string,
  alternatives?: Title[],
  followUpQuestions?: string[]
}
```

### GET /v1/chat/stream (SSE)
```
Query: ?session=xxx&message=xxx&profileId=xxx
Events: message | done | error
```

---

## Files Summary

### Files to CREATE

| File Path | Epic | Purpose |
|-----------|------|---------|
| `docs/adr/0002-mcp-agentic-architecture.md` | 0/8 | Architecture decision |
| `server/agents/orchestrator.ts` | 8 | Central orchestration |
| `server/agents/types.ts` | 8 | TypeScript interfaces |
| `server/agents/context.ts` | 8 | Conversation state (Redis) |
| `server/agents/config.ts` | 0/8/9 | Feature flags, plan gating, limits |
| `server/agents/safety.ts` | 8 | Input/output filters, prompt redaction |
| `server/agents/telemetry.ts` | 5/12 | LLM cost tracking, metrics |
| `server/agents/workers/*.ts` | 8 | 4 specialist workers |
| `server/mcp/client.ts` | 0/8 | MCP SDK wrapper with caching/backoff |
| `server/mcp/registry.ts` | 8 | Tool discovery |
| `server/mcp/adapters/*.ts` | 1/8 | MCP server adapters |
| `server/chat/router.ts` | 2/8 | Chat API routes |
| `server/chat/session.ts` | 8 | Session management |
| `.mcp.json` | 8 | MCP configuration |
| `apps/web/src/components/chat/*.tsx` | 4/8 | Chat UI components |
| `whot2watch-docs/docs/analytics/events/chat_*.json` | 5 | AI event schemas |
| `scripts/load-tests/chat.k6.js` | 6 | Load test scenarios |
| `.zap/chat-scan.yaml` | 6 | Security scan config |
| `docs/mobile-chat-integration.md` | 3 | Mobile integration guidance |

### Files to MODIFY

| File | Epic | Changes |
|------|------|---------|
| `ROADMAP/08-AI-and-Social.md` | 8 | Add MCP checklist items |
| `package.json` | 0 | Add @modelcontextprotocol/sdk, zod |
| `server/api.ts` | 2 | Import and register chat routes |
| `apps/web/src/app/layout.tsx` | 4 | Add ChatPanel component |
| `apps/web/src/components/home/HomePage.tsx` | 4 | Search bar NLU augment (optional) |
| `Whot2Watch-docs/docs/rest/openapi.yaml` | 2 | Add /v1/chat endpoints |
| `vitest.config.ts` | 6 | Add coverage paths |
| `.env.example` | 0 | Add AI/MCP env vars |

---

## Dependencies to Add

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "zod": "^3.24.0"
  }
}
```

## Environment Variables to Add

```bash
# AI/MCP Configuration (Epic 8)
AI_CONCIERGE_ENABLED=true          # Feature flag
NLU_ENABLED=true                   # Enable NLU parsing
SOCIAL_FEED_ENABLED=true           # Include social context

# LLM Provider (Epic 8)
LLM_PROVIDER=anthropic             # anthropic | openai | none
ANTHROPIC_API_KEY=                 # If using Anthropic
OPENAI_API_KEY=                    # If using OpenAI

# Cost Controls (Epic 8/12)
LLM_DAILY_LIMIT_FREE=10            # Messages/day for free tier
LLM_DAILY_LIMIT_PREMIUM=1000       # Messages/day for premium
LLM_MONTHLY_BUDGET_USD=500         # Alert threshold

# Safety (Epic 8)
CHAT_PROMPT_REDACTION=true         # Hash prompts in logs
CHAT_SAFETY_FILTER=true            # Enable content filtering
```

---

## Verification Plan

### Unit Tests (Epic 6)
```bash
pnpm test -- server/agents/
pnpm test -- server/mcp/
pnpm test -- server/chat/
```

### Integration Tests (Epic 6)
```bash
# Start services
docker compose up -d postgres redis opensearch

# Run API with chat enabled
AI_CONCIERGE_ENABLED=true pnpm api:dev

# Test chat endpoint
curl -X POST http://localhost:4000/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Recommend a sci-fi movie on Netflix"}'

# Test SSE streaming
curl "http://localhost:4000/v1/chat/stream?session=test&message=Find%20Dune"

# Test feature flag fallback (disabled)
AI_CONCIERGE_ENABLED=false pnpm api:dev
# Should return fallback/error response

# Test MCP fallback (simulate unavailable)
# Stop TMDB MCP server → chat should use local DB
```

### MCP Fallback E2E Tests (Epic 1/6)
```bash
# Test with AVAILABILITY_SOURCE=TMDB (local DB)
AVAILABILITY_SOURCE=TMDB pnpm api:dev
curl -X POST http://localhost:4000/v1/chat -d '{"message": "Where can I watch Dune?"}'
# Should return availability from local Prisma

# Test hybrid: MCP for trending, local for user data
curl -X POST http://localhost:4000/v1/chat -d '{"message": "What's trending?"}'
# Should call TMDB MCP; user prefs from local
```

### Load Testing (Epic 6/12)
```bash
# Install k6
# Run chat load test
k6 run scripts/load-tests/chat.k6.js

# Targets:
# - P95 response time < 3s
# - Error rate < 1%
# - Concurrent users: 50
```

### Security Testing (Epic 6)
```bash
# Run ZAP scan on chat endpoint
zap-baseline.py -t http://localhost:4000/v1/chat -c .zap/chat-scan.yaml

# Verify:
# - No prompt injection vulnerabilities
# - Input sanitization working
# - No PII in responses
```

### Frontend Tests (Epic 4/6)
```bash
pnpm --filter web test
# Manual: Open http://localhost:3000, click chat bubble, send message
# Manual: Type query in search bar → verify NLU augment (if enabled)
```

### Full QA (Epic 6)
```bash
pnpm qa           # All quality gates
pnpm coverage     # Verify 80% threshold maintained
```

### Analytics Validation (Epic 5)
```bash
# Verify AI events in analytics
curl -X POST http://localhost:4000/v1/chat -d '{"message": "test"}'
# Check analytics buffer for:
# - chat_message_sent event
# - chat_response_received event
# - llm_tokens_used metric
```

### Acceptance Criteria Validation (Epic 8)
- [ ] Users complete cold-start and receive subscription-aware picks with "Why this?" reasons
- [ ] Conversational query maps to search filters when LLM disabled
- [ ] LLM requests capped per-user/day; prompts redacted
- [ ] Safety filters block unsafe responses
- [ ] Feature flag `AI_CONCIERGE_ENABLED=false` falls back gracefully
- [ ] Social context included when `SOCIAL_FEED_ENABLED=true`

### Monetization Validation (Epic 9)
- [ ] Free tier: 10 chat messages/day limit enforced
- [ ] Premium tier: Unlimited messages
- [ ] Rate limit returns 429 with upgrade prompt

---

## Risk Mitigation

| Risk | Mitigation | Epic Reference |
|------|------------|----------------|
| MCP server unavailable | Fallback to local DB via `AVAILABILITY_SOURCE` | Epic 1/8: NLU fallback |
| Token costs | Budget caps + per-user limits + code execution pattern | Epic 8/9/12: cost controls |
| Latency | Redis caching + lazy MCP loading + async streaming | Epic 2/12: caching |
| Breaking existing API | Chat is additive; REST unchanged; versioned | Epic 2: API versioning |
| Unsafe LLM outputs | Input/output filters + prompt redaction | Epic 8: safety filters |
| Data inconsistency | MCP for real-time, local DB for user data | Epic 1: hybrid strategy |
| Mobile compatibility | Shared backend; feature flags respect client | Epic 3 |
| Free tier abuse | Server-side plan enforcement + rate limiting | Epic 9: freemium gating |
| LLM provider outage | Multi-provider fallback (Anthropic → OpenAI → NLU) | Epic 8: provider selection |
| Cost overruns | Daily/monthly budget alerts; auto-disable at threshold | Epic 12: cost monitoring |
| Security vulnerabilities | ZAP scan; input sanitization; no PII in logs | Epic 6: security testing |

---

## Success Criteria

**Performance (Epic 6/12):**
1. Chat endpoint P95 < 3s for simple queries
2. Load test: 50 concurrent users, < 1% error rate
3. Existing REST endpoints unaffected (all tests pass)

**Functionality (Epic 8):**
4. MCP servers lazy-load on first use
5. Conversation context persists across turns
6. Feature flag disables AI gracefully with NLU fallback
7. Cold-start preferences integrated into chat recommendations
8. Social context included when enabled

**Security (Epic 6/8):**
9. ZAP scan passes with no critical findings
10. Prompt redaction verified (no raw prompts in logs)
11. Safety filters block unsafe inputs/outputs

**Quality (Epic 0/6):**
12. 80% test coverage maintained
13. ADR documented and approved
14. All contract validations pass

**Cost (Epic 8/9/12):**
15. Per-user/day LLM rate limits enforced
16. Freemium tier gates working (10 msg/day free)
17. LLM cost tracking visible in dashboards
18. Budget alerts configured

**Cross-Epic:**
19. All Epic 8 acceptance criteria met
20. Mobile backend support verified (shared endpoint)
21. Analytics events tracked per Epic 5 schema

---

## GitHub Issue Mapping

Per ROADMAP/README.md tracking rules, create issues with epic labels:

### Epic 0 (Foundations)
- `[Epic 0] Add MCP SDK and Zod dependencies`
- `[Epic 0] HTTP caching/backoff utility for MCP client`

### Epic 1 (Data Model)
- `[Epic 1] MCP/local DB hybrid strategy implementation`
- `[Epic 1] AVAILABILITY_SOURCE flag handling for MCP`

### Epic 2 (Backend API)
- `[Epic 2] POST /v1/chat endpoint`
- `[Epic 2] GET /v1/chat/stream SSE endpoint`
- `[Epic 2] OpenAPI spec update for chat endpoints`
- `[Epic 2] APM integration for chat endpoint`

### Epic 3 (Mobile)
- `[Epic 3] Mobile chat backend support documentation`
- `[Epic 3] Feature flag header support for mobile`

### Epic 4 (Web)
- `[Epic 4] ChatPanel floating component`
- `[Epic 4] Search bar NLU augment (optional)`
- `[Epic 4] useChat React hook`

### Epic 5 (Analytics)
- `[Epic 5] AI event schema definition`
- `[Epic 5] LLM telemetry integration`

### Epic 6 (Testing)
- `[Epic 6] Chat endpoint unit tests`
- `[Epic 6] MCP adapter integration tests`
- `[Epic 6] k6 load test scenarios`
- `[Epic 6] ZAP security scan configuration`

### Epic 8 (AI & Social) - Primary
- `[Epic 8] ADR: MCP-based agentic architecture`
- `[Epic 8] MCP infrastructure setup (.mcp.json, client)`
- `[Epic 8] Worker agents (Search, Availability, Preferences, Recommendations)`
- `[Epic 8] Orchestrator and intent classification`
- `[Epic 8] Conversation context management (Redis)`
- `[Epic 8] Feature flags (AI_CONCIERGE_ENABLED, NLU_ENABLED)`
- `[Epic 8] Safety filters and prompt redaction`
- `[Epic 8] LLM provider selection and fallback`
- `[Epic 8] Cold-start integration`
- `[Epic 8] Social context in chat (SOCIAL_FEED_ENABLED)`

### Epic 9 (Monetization)
- `[Epic 9] Freemium gating for chat (10 msg/day)`
- `[Epic 9] Plan-tier enforcement for LLM access`

### Epic 12 (Operations)
- `[Epic 12] LLM cost monitoring and dashboards`
- `[Epic 12] Budget alerts and auto-disable`
- `[Epic 12] Chat endpoint scaling strategy`

---

## ROADMAP Checklist Updates

### Added to `ROADMAP/08-AI-and-Social.md`

MCP Architecture section with full checklist (infrastructure, adapters, agents, workers, orchestrator, chat API, frontend, production).

### Pending additions to other ROADMAP files:

**`ROADMAP/00-Foundations.md`** - Add under "Minimal Redis-backed HTTP cache/backoff utility":
```markdown
- [ ] MCP client caching/backoff integration
```

**`ROADMAP/05-Alerts-Notifications-Analytics.md`** - Add under "Analytics hardening":
```markdown
- [ ] AI event schema (`chat_message_sent`, `chat_response_received`, `llm_tokens_used`)
- [ ] LLM cost dashboard integration
```

**`ROADMAP/06-Testing-Performance-Security-Privacy.md`** - Add:
```markdown
- [ ] Chat endpoint load testing (k6, P95 < 3s)
- [ ] Chat endpoint security testing (ZAP scan)
- [ ] MCP fallback E2E tests
```

**`ROADMAP/09-Monetization-and-Growth.md`** - Add:
```markdown
- [ ] AI chat freemium gating (10 msg/day free tier)
- [ ] Premium AI chat unlimited
```

---

## Tracking Metadata

**Plan ID:** `bubbly-sprouting-ritchie`
**Created:** 2026-01-25
**Primary Epic:** Epic 8 (AI & Social)
**Cross-Epic Dependencies:** 0, 1, 2, 3, 4, 5, 6, 9, 12
**Total New Files:** 19
**Total Modified Files:** 8
**GitHub Issues to Create:** 27
