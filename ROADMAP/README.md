# Roadmap Index

- Epic 0 — Foundations, Repo, Quality Gates
- Epic 1 — Data Model, DB, Search, Ingestion
- Epic 2 — Backend API & Services
- Epic 3 — Mobile App (React Native/Expo)
- Epic 4 — Web Companion (Next.js)
- Epic 5 — Alerts, Notifications, Analytics
- Epic 6 — Testing, Performance, Security, Privacy
- Epic 8 — AI & Social (Concierge, Social Discovery, Sharing)
- Epic 9 — Monetization & Growth (Freemium, Affiliates, B2B)
- Epic 10 — User Research & Validation
- Epic 11 — Content & Marketing
- Epic 12 — Operations & Scale

## Timeline Overview (Restructured)

- Week 1–2: Foundations (hardening) + Data Model/Integration (accelerated)
- Week 2–4: AI & Social (moved earlier) + Backend APIs (affiliate plumbing)
- Week 4–6: Mobile + Web with AI/social
- Week 6–7: Alerts/Notifications
- Week 6–8: Monetization & Growth
- Week 6–12: Operations & Scale (parallel)
- Week 9–10: Launch prep (Testing/Security hardening continued)
- Week 11–12: Launch + Optimization

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
