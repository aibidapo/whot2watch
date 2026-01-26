# MCP-Based Agentic Architecture

## Status

Accepted

## Context

Epic 8 (AI & Social) requires an AI Concierge with conversational search capabilities. The system needs to:

1. Understand natural language queries like "Find me a short comedy on Netflix"
2. Provide personalized recommendations based on user preferences and subscriptions
3. Check real-time streaming availability across providers
4. Fall back gracefully when AI services are unavailable
5. Control costs and ensure safety

We evaluated three approaches:
- Direct LLM API integration (OpenAI/Anthropic SDKs)
- MCP-based tool architecture (Model Context Protocol)
- Custom agent framework

## Decision

Adopt **MCP (Model Context Protocol)** with an **Orchestrator-Workers** pattern:

### Architecture Overview

```
User Query → Orchestrator Agent → Worker Agents → MCP Tools / Local DB → Response
```

### Key Components

1. **Orchestrator Agent** (`server/agents/orchestrator.ts`)
   - Classifies user intent (search, availability, recommendations, preferences)
   - Routes to appropriate worker agents
   - Aggregates and formats responses

2. **Worker Agents** (`server/agents/workers/`)
   - **Search Worker**: Natural language to OpenSearch/TMDB queries
   - **Availability Worker**: JustWatch/Watchmode MCP for streaming availability
   - **Preferences Worker**: User preferences from local Prisma database
   - **Recommendations Worker**: Scoring, diversity, and explanation generation

3. **MCP Layer** (`server/mcp/`)
   - **TMDB MCP Server**: Real-time movie/TV metadata, trending, recommendations
   - **JustWatch MCP Server**: Regional streaming availability
   - Progressive tool discovery (lazy loading)
   - HTTP caching/backoff for resilience

4. **Hybrid Data Strategy**
   - Real-time lookups: MCP servers (trending, availability checks)
   - Bulk data: Existing ingestion pipelines (nightly refresh)
   - User data: Always local Prisma (preferences, subscriptions, feedback)

### Feature Flags

- `AI_CONCIERGE_ENABLED`: Enable/disable chat endpoint
- `NLU_ENABLED`: Enable/disable NLU parsing (fallback to filters)
- `SOCIAL_FEED_ENABLED`: Include friends' activity in context

### API Endpoints

- `POST /v1/chat`: Non-streaming chat request
- `GET /v1/chat/stream`: Server-Sent Events streaming

## Consequences

### Positive

- **Standardized tool interface**: MCP provides consistent tool definitions across LLM providers
- **Real-time external data**: TMDB/JustWatch MCP servers provide fresh data without ingestion pipelines
- **Token efficiency**: Code execution pattern reduces token usage by ~98% for complex queries
- **Provider flexibility**: Can switch LLM providers (Anthropic ↔ OpenAI) without changing tool logic
- **Graceful degradation**: Falls back to NLU rules → local DB when MCP unavailable
- **Extensibility**: New MCP servers can be added without code changes

### Negative

- **New dependency**: MCP SDK adds complexity and a new dependency to manage
- **Debugging complexity**: Agent flows span multiple components, harder to trace
- **Latency**: MCP server startup adds latency on first use (mitigated by lazy loading)
- **External service reliability**: Depends on third-party MCP servers being available

### Mitigations

| Risk | Mitigation |
|------|------------|
| MCP unavailable | Fallback to local DB via `AVAILABILITY_SOURCE` flag |
| Token costs | Budget caps + per-user limits + code execution pattern |
| Latency | Redis caching + lazy loading + async streaming |
| Security | Input/output safety filters + prompt redaction |

## Alternatives Considered

### 1. Direct OpenAI/Anthropic API Integration

**Pros:**
- Simpler implementation
- Direct control over prompts
- No additional dependencies

**Cons:**
- Provider lock-in
- No standardized tool interface
- Must manage tool definitions manually
- No progressive discovery

**Rejected because:** Less flexible for future provider changes and lacks tool standardization.

### 2. LangChain Framework

**Pros:**
- Rich ecosystem of tools and chains
- Built-in memory management
- Community support

**Cons:**
- Heavy abstraction layer
- Opinionated patterns may not fit our architecture
- Significant learning curve
- Performance overhead

**Rejected because:** Over-engineered for our use case; too much abstraction.

### 3. Custom Agent Framework

**Pros:**
- Full control over architecture
- Optimized for our specific needs
- No external dependencies

**Cons:**
- High development and maintenance cost
- Must build tool integration from scratch
- Risk of reinventing existing solutions

**Rejected because:** MCP provides the standardization we need with less effort.

## References

- [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Anthropic: Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [TMDB MCP Server](https://github.com/leonardogilrodriguez/mcp-tmdb)
- [mcp-justwatch](https://www.piwheels.org/project/mcp-justwatch/)

## Related

- Epic 8: AI & Social (`ROADMAP/08-AI-and-Social.md`)
- Epic 0: ADR requirement (`ROADMAP/00-Foundations.md`)
