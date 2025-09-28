# Branch Protection Policy

- Protected branches: `main`
- Required checks: full CI (format, lint, typecheck, contracts, tests, coverage >= 80%, semgrep, gitleaks, depcruise, knip, pipeline-smoke)
- Require pull request reviews: at least 1 (self-review acceptable for solo dev, but prefer deliberate review checks)
- Dismiss stale approvals when new commits are pushed
- Require branches to be up to date before merging
- Enforce conventional commits via commitlint

How to enable:

- GitHub → Settings → Branches → Branch protection rules → Add rule for `main` with the options above.
