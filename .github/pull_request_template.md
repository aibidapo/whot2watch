## Summary

Describe the change and why it is needed.

## Checklist

- [ ] CI is green (format, lint, typecheck, contracts, tests, coverage >= 80%, semgrep, gitleaks, depcruise, knip)
- [ ] Contracts updated as needed (OpenAPI/GraphQL/Mermaid) and codegen ran
- [ ] Roadmap updated for any implemented changes (`ROADMAP/` docs)
- [ ] No TODO/FIXME left in code or specs
- [ ] Tests added/updated (unit/integration/e2e as applicable)
- [ ] Security considerations reviewed (rate limiting, validation, headers)
- [ ] If data model changed, migrations included and seeds updated

## Screenshots / Evidence (optional)

Add links or images if helpful.

## Summary

<!-- What does this PR change? -->

## Checklist

- [ ] Tests added/updated (unit/integration/E2E)
- [ ] Coverage thresholds remain ≥ 80%
- [ ] Lint, typecheck, and format pass locally
- [ ] OpenAPI validated + Spectral linted; GraphQL schema linter passes; ERD Mermaid check passes
- [ ] Roadmap updated for any code/contract changes (enforced)
- [ ] Names follow Glossary.md; no TODO/FIXME left
- [ ] No duplicated logic; re-used existing utils where possible
- [ ] If introducing patterns/modules, include ADR under `docs/adr/`
