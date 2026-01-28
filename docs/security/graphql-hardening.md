# GraphQL Hardening

## Overview

GraphQL endpoints are hardened with depth limiting, cost analysis, and introspection control. Implementation lives in `server/security/graphqlEnvelop.ts`.

## Depth Limiting

- **Max depth**: 8 (configurable via `graphqlDepthLimit(maxDepth)`)
- Recursively walks the AST including fragment spreads
- Queries exceeding the depth limit are rejected with a `GraphQLError` before execution

Example of a rejected query (depth 10):
```graphql
{ user { friends { friends { friends { friends { friends { friends { friends { friends { friends { name } } } } } } } } } } }
```

## Cost Analysis

- **Max cost**: 1000 (configurable via `graphqlCostLimit(maxCost)`)
- Scalar fields cost 1 point
- Fields with nested selections cost 10 points (assumes list-like access)
- Fragment spreads are expanded and costed recursively
- Wide queries with many aliased top-level fields are naturally expensive

## Introspection Control

- `disableIntrospectionInProd()` blocks `__schema` and `__type` queries when `NODE_ENV=production`
- Introspection remains available in development and test environments for tooling

## Usage

All three rules are combined via the convenience export:

```typescript
import { graphqlHardeningRules } from './server/security/graphqlEnvelop';

const rules = graphqlHardeningRules({ maxDepth: 8, maxCost: 1000 });
// Pass `rules` as additional validation rules to your GraphQL server
```

## Additional Recommendations

- Prefer persisted/allowlisted queries for public-facing endpoints
- Validate all inputs at the resolver level
- Avoid dynamic resolvers that construct queries from user input
- Sanitize error messages in production (do not leak internal details)
- Log rejected queries for security monitoring
