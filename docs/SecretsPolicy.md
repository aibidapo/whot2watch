# Secrets Policy — What2Watch

- Use a secrets manager (Doppler/Vault/SOPS). No secrets in repo.
- Local dev: use `.env` with least-privilege tokens.
- Rotate credentials regularly; revoke on churn.
- Do not log secrets/PII; enable redaction in logs.
- Audit with `pnpm qa:gitleaks` before merge.

