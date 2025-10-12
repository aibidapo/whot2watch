# Environment Variables (Example)

Copy these to your secrets manager or local `.env`.

API

- NODE_ENV=development
- PORT=4000
- NEXT_PUBLIC_API_URL=http://localhost:4000
- NEXT_PUBLIC_DEFAULT_REGIONS=US # Comma-separated, e.g. US,CA
- API_DOCS_ENABLED=true # serve /v1/docs in production when true

External APIs

- TMDB_API_KEY=
- TMDB_ACCESS_TOKEN=
- OMDB_API_KEY=
- JUSTWATCH_PARTNER=
- TRAKT_CLIENT_ID=

Defaults (optional)

- DEFAULT_REGIONS=US # Server default regions for trending/search when not provided

Testing

- TEST_WITH_CONTAINERS=false # Set true to force Testcontainers for DB/Redis/OS in tests

Database

- DATABASE_URL=
- REDIS_URL=

Auth

- OIDC_ISSUER_URL=
- OIDC_CLIENT_ID=
- OIDC_AUDIENCE=

Observability

- SENTRY_DSN=

Analytics (optional)

- ANALYTICS_WEBHOOK_URL=
- ANALYTICS_TOKEN=
- ANALYTICS_BUFFER=false
- ANALYTICS_BUFFER_INTERVAL_MS=5000
- ANALYTICS_BUFFER_MAX=50

Affiliates (optional)

- AFFILIATES_ENABLED=false
