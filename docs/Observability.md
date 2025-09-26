# Observability — What2Watch

- Structured logging via `server/common/logger.ts` with redaction (tokens, secrets, passwords)
- Request ID middleware via `server/common/requestId.ts` adds `x-request-id`
- Recommend wiring logs to Datadog/OpenSearch/CloudWatch with JSON ingestion

