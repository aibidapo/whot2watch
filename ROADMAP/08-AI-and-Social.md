# Epic 8 — AI & Social (Concierge, Social Discovery, Sharing) (W2–W4)

Note: depends on Epic 1 data foundation (imdbId, popularity, providers, ratings) being available by end of W2.

Checklist

- [x] AI Concierge MVP (feature-flagged; safe fallback to filters)
- [x] Conversational search → filter translation (NLU fallback)
- [x] Cold-start onboarding (taste chips + subscriptions)
- [x] Subscription-aware picks boosts and reasons
- [x] Friends' activity feed (MVP) and Friends' Picks
- [x] Shareable lists and picks (OpenGraph cards)
- [x] Telemetry for AI/social adoption; privacy guardrails
- [x] LLM provider selection, prompt framework, cost controls, safety filters

Acceptance Criteria

- Users complete cold-start and receive subscription-aware picks with “Why this?” reasons
- Conversational query maps to search filters when LLM is disabled or unavailable
- Friends' feed shows recent likes/saves; Friends' Picks available as an alternative tab
- Share links render OG previews and open to the correct list/pick set
- LLM requests capped per-user/day; prompts redacted; safety filters block unsafe responses

Step-by-Step Implementation Plan

1. Feature Flags & Safety

- Add flags: `AI_CONCIERGE_ENABLED`, `NLU_ENABLED`, `SOCIAL_FEED_ENABLED`
- Implement server-side gating; fallback to existing search/picks paths
- Redact logs (no prompts/PII); store only counters and hashed prompts (optional)

2. AI Infrastructure

- Provider evaluation (OpenAI, Anthropic, self-hosted) and initial selection
- Prompt framework: templates + variables; few-shot examples stored server-side
- Safety: content filters on inputs/outputs; rate limiting; per-user/day quotas
- Cost controls: budget caps; backoff to NLU when limits reached

3. Cold-Start & Boosts

- UX: 2–5 taste chips (genres/moods) + subscriptions capture
- Backend: persist preferences; picks scoring boosts for subscription-available titles; surface “On your services” reason

4. Conversational Search (NLU Fallback)

- MVP: parse intents for duration, genre/mood, service, region
- Map to search filters; if LLM disabled, use rules-based NLU

5. AI Concierge Endpoint (Optional Gate)

- Endpoint: `POST /ai/concierge { query, profileId, context }`
- Response: `{ recommendations, reasoning, alternatives, followUpQuestions }`
- Rate limit and RBAC where applicable

6. Social Feed & Friends' Picks

- Use `Feedback` (LIKE, SAVE) as activity stream foundation
- API: `GET /social/feed` returns friends' recent actions with titles
- Friends' Picks: rank titles popular among friends in last N days

7. Sharing

- Public links for lists and My Picks; OG cards (title, image, badges)
- Route to prefilled view; allow opt-out via Private Mode

## MCP Architecture

Reference: `docs/adr/0002-mcp-agentic-architecture.md`

- [x] ADR: MCP-based agentic architecture (`docs/adr/0002-mcp-agentic-architecture.md`)
- [x] MCP infrastructure
  - [x] `.mcp.json` configuration
  - [x] MCP client with caching/backoff (`server/mcp/client.ts`)
  - [x] Tool registry with progressive discovery (`server/mcp/registry.ts`)
- [x] MCP Adapters
  - [x] TMDB adapter (`server/mcp/adapters/tmdb.adapter.ts`)
  - [x] JustWatch adapter (`server/mcp/adapters/justwatch.adapter.ts`)
- [x] Agent Infrastructure (partial)
  - [x] Type definitions (`server/agents/types.ts`)
  - [x] Conversation context (`server/agents/context.ts`)
  - [x] Feature flag config (`server/agents/config.ts`)
  - [x] Safety filters (`server/agents/safety.ts`)
  - [x] Telemetry (`server/agents/telemetry.ts`)
- [x] Worker Agents
  - [x] Search worker (`server/agents/workers/search.worker.ts`)
  - [x] Availability worker (`server/agents/workers/availability.worker.ts`)
  - [x] Preferences worker (`server/agents/workers/preferences.worker.ts`)
  - [x] Recommendations worker (`server/agents/workers/recommendations.worker.ts`)
- [x] Orchestrator (`server/agents/orchestrator.ts`)
  - [x] Intent classification (rules-based NLU)
  - [x] Worker routing (parallel + sequential pipelines)
  - [x] Response aggregation
  - [x] Entity extraction (genres, services, moods, duration, year, region)
  - [x] Follow-up question generation
- [x] Chat API
  - [x] POST /v1/chat endpoint (`server/chat/router.ts`)
  - [x] SSE streaming (`server/chat/router.ts` — GET /chat/stream)
  - [x] Session management (`server/chat/session.ts`)
  - [x] Feature-flag gating (503 when disabled)
  - [x] Rate limiting (per-user/day via Redis)
  - [x] Routes registered in `server/api.ts`
- [x] Frontend
  - [x] ChatPanel component (`apps/web/src/components/chat/ChatPanel.tsx`)
  - [x] useChat hook (`apps/web/src/components/chat/hooks/useChat.ts`)
  - [x] Search bar NLU augment
- [ ] Production
  - [x] Rate limiting (per-user/day)
  - [x] Freemium gating
  - [x] LLM cost monitoring (`/v1/chat/metrics` endpoint)
  - [x] Safety filters enabled (input/output validation, PII redaction)
  - [ ] Load testing (k6)
  - [ ] Security testing (ZAP)

Testing Strategy

- Unit
  - NLU intent parser → filter mapping; boost functions combining popularity/subscriptions
  - Feature-flag gates and fallbacks; prompt templating units
  - Agent workers (search, availability, preferences, recommendations)
  - MCP adapters mocking external servers
- Integration
  - Cold-start → boosted picks with reasons; conversational query → filtered results
  - Social feed returns friend actions; share link renders OG meta
  - LLM request caps and safety filters block as expected; NLU fallback engaged
  - MCP fallback to local DB when external servers unavailable
  - Chat endpoint with Redis session persistence
- E2E
  - New user completes onboarding → receives relevant picks with reasons
  - Friend likes titles → appears in feed; Friends' Picks tab updates
  - LLM quota exhausted → fallback path retains functionality
  - Chat conversation maintains context across turns
  - Feature flag `AI_CONCIERGE_ENABLED=false` disables chat gracefully

Metrics & Telemetry

- Activation: % users completing cold-start
- AI usage: conversational search calls, concierge calls, fallback rates, blocked-by-safety counts
- Social: feed views, Friends' Picks CTR, shares per user
- Privacy: Private Mode usage; zero PII in logs confirmed
