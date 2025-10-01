## Development

- Start full stack (API, Web, Docker infra):
  - `pnpm dev:all` (add `--skip-ingest` for faster startup)
  - Stop everything: `pnpm dev:down`
  - Restart: `pnpm dev:restart --skip-ingest`
  - API: http://localhost:4000, Web: http://localhost:3000
  - Web uses `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:4000`)
