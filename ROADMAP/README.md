# What2Watch MVP Roadmap — Overview

This folder contains the execution roadmap with checkable items, acceptance criteria, and test plans.

Documents

- 00-Foundations.md
- 01-Data-Model-DB-Search-Ingestion.md
- 02-Backend-API-Services.md
- 03-Mobile-App.md
- 04-Web-Companion.md
- 05-Alerts-Notifications-Analytics.md
- 06-Testing-Performance-Security-Privacy.md
- 07-Release-Launch.md

Tracking

- Map each checklist line to a GitHub issue labeled by epic.
- Gate merges with CI green (format, lint, typecheck, contracts, coverage ≥80, duplication ≤5%, gitleaks, security CI).
- Venv activation is mandatory before running repo scripts.

Check-off Rule (Enforced)

- Any change to code/contracts must include corresponding updates in `ROADMAP/`.
- CI and pre-push will fail if code changes land without ROADMAP updates.
