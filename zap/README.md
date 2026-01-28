# OWASP ZAP Security Testing

Dynamic Application Security Testing (DAST) for the Whot2Watch API using [OWASP ZAP](https://www.zaproxy.org/).

## What It Does

ZAP baseline scan performs **passive** analysis of HTTP responses — it does not actively attack the target. It checks for:

- Missing security headers (HSTS, CSP, X-Content-Type-Options, etc.)
- Information disclosure (server version, debug info, sensitive data in URLs)
- Cookie security flags (HttpOnly, Secure, SameSite)
- Cache-control directives
- CORS misconfigurations

This complements **Semgrep SAST** (static analysis) which runs on every PR.

## Rules File

`zap/rules.tsv` tunes ZAP alerts for our stateless JSON API:

- **IGNORE** — false positives (e.g., cookie rules on a cookieless API, CSP for non-HTML)
- **WARN** — items needing manual review (proxy disclosure, caching strategy)
- **FAIL** — would break CI (none configured by default)

Format: `<alert-id>\t<action>\t(<description>)`

To update: find the alert ID in [ZAP Alert Reference](https://www.zaproxy.org/docs/alerts/), add a row with the desired action.

## CI Schedule

| Trigger | When |
|---------|------|
| `schedule` | Weekly — Monday 3:00 AM UTC |
| `workflow_dispatch` | Manual via GitHub Actions UI |
| `pull_request` | SAST only (Semgrep); ZAP runs on schedule/manual |

Reports (HTML + JSON) are uploaded as GitHub Actions artifacts.

## Running Locally

```bash
docker run --rm -v "$(pwd)/zap:/zap/wrk:rw" \
  -t ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py \
    -t http://host.docker.internal:4000 \
    -c rules.tsv \
    -J zap-report.json \
    -r zap-report.html
```

On Windows (PowerShell):

```powershell
docker run --rm -v "${PWD}/zap:/zap/wrk:rw" `
  -t ghcr.io/zaproxy/zaproxy:stable `
  zap-baseline.py `
    -t http://host.docker.internal:4000 `
    -c rules.tsv `
    -J zap-report.json `
    -r zap-report.html
```

Reports will be written to the `zap/` directory.
