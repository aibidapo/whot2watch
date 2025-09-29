# Epic 8 — AI & Social (Concierge, Social Discovery, Sharing) (W2–W4)

Note: depends on Epic 1 data foundation (imdbId, popularity, providers, ratings) being available by end of W2.

Checklist

- [ ] AI Concierge MVP (feature-flagged; safe fallback to filters)
- [ ] Conversational search → filter translation (NLU fallback)
- [ ] Cold-start onboarding (taste chips + subscriptions)
- [ ] Subscription-aware picks boosts and reasons
- [ ] Friends' activity feed (MVP) and Friends' Picks
- [ ] Shareable lists and picks (OpenGraph cards)
- [ ] Telemetry for AI/social adoption; privacy guardrails
- [ ] LLM provider selection, prompt framework, cost controls, safety filters

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

Testing Strategy

- Unit
  - NLU intent parser → filter mapping; boost functions combining popularity/subscriptions
  - Feature-flag gates and fallbacks; prompt templating units
- Integration
  - Cold-start → boosted picks with reasons; conversational query → filtered results
  - Social feed returns friend actions; share link renders OG meta
  - LLM request caps and safety filters block as expected; NLU fallback engaged
- E2E
  - New user completes onboarding → receives relevant picks with reasons
  - Friend likes titles → appears in feed; Friends' Picks tab updates
  - LLM quota exhausted → fallback path retains functionality

Metrics & Telemetry

- Activation: % users completing cold-start
- AI usage: conversational search calls, concierge calls, fallback rates, blocked-by-safety counts
- Social: feed views, Friends' Picks CTR, shares per user
- Privacy: Private Mode usage; zero PII in logs confirmed
