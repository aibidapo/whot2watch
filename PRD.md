# Product Requirements Document (PRD) – Whot2Watch MVP

This document is a consolidated copy of the PRD details from the shared link and captures the MVP scope for APIs and analytics. Source link is included at the end.

## Status Snapshot

- ERD: Finalized (use the Mermaid ERD previously provided as source of truth).
- API Contract: GraphQL marked “Done”; REST fallback defined for parity and tooling.
- Analytics: Event envelope and MVP event catalog defined; privacy constraints included.

## REST Fallback (MVP Endpoints)

- Purpose: parity for non-GraphQL consumers, webhooks, and quick tooling.
- Auth: Bearer JWT.
- Errors: JSON { "error": { "code": "FORBIDDEN", "message": "…" } }.

### Picks & Search

- GET /v1/picks?profileId={id}&limit=5
  → 200 [ { id, title: {…}, score, reason, createdAt } ]
- GET /v1/search?q=…&region=US&providerIn=NETFLIX,PRIME&runtimeLt=90
  → 200 { items: [ { id, name, type, genres, availability:[…] } ], nextCursor }
- GET /v1/availability/{titleId}?region=US&services=NETFLIX,PRIME
  → 200 [ { service, region, offerType, deepLink, lastSeenAt } ]

### Feedback & Lists

- POST /v1/feedback
  Body: {"profileId","titleId","action":"LIKE|DISLIKE|SAVE","reasonOpt":"optional"}
  → 200 { id, profileId, titleId, action, reasonOpt, ts }
- POST /v1/lists
  Body: {"profileId","name","visibility":"PRIVATE|FRIENDS|PUBLIC|COLLAB","description"}
  → 200 { id, … }
- POST /v1/lists/{listId}/items
  Body: {"titleId","note","position"}
  → 200 { id, listId, title:{…}, position, addedAt }
- DELETE /v1/lists/{listId}/items/{itemId}
  → 204

### Subscriptions & Preferences

- POST /v1/subscriptions
  Body: {"profileId","service":"NETFLIX","region":"US"}
  → 200 { id, … }
- DELETE /v1/subscriptions/{id}
  → 204
- PATCH /v1/profiles/{id}/preferences
  Body: {"genres":[],"dislikedGenres":[],"moods":[],"languages":[],"runtimePreferredMin":0,"runtimePreferredMax":180}
  → 200 { id, preferences }

### Alerts

- POST /v1/alerts
  Body: {"profileId","titleId":"optional","alertType":"availability|new_season|actor|genre","services":["NETFLIX"],"region":"US"}
  → 200 { id, status:"active" }
- DELETE /v1/alerts/{id}
  → 204

### Social & Group Night

- POST /v1/friends/requests
  Body: {"profileId","toProfileId"}
  → 200 { id, status:"REQUESTED" }
- POST /v1/friends/{id}/respond
  Body: {"accept":true}
  → 200 { id, status:"ACCEPTED" }
- POST /v1/group-sessions
  Body: {"hostProfileId","name","constraints":{ "runtimeLt":90, "services":["NETFLIX"] }}
  → 200 { id, status:"open" }
- POST /v1/group-sessions/{id}/candidates
  Body: {"titleId"}
  → 204
- POST /v1/group-sessions/{id}/vote
  Body: {"profileId","titleId","value":1}
  → 200 { id, voteValue, ts }
- POST /v1/group-sessions/{id}/close
  → 200 { id, status:"closed", fairnessScore }

### NLU (Phase 2)

- GET /v1/nlu/search?q=short%20comedy%20on%20netflix&profileId={id}&first=20&after=…
  → 200 { parse:{ intent, entities, confidence }, results:{ items:[…], nextCursor }, relaxed, relaxNotes }

## Analytics & Event Schema (MVP → Phase 2)

Goal: power product metrics, evaluations, growth analysis, diagnostics—while respecting privacy. In Private Mode, do not emit user-linked events; allow aggregate-only.

### Event Envelope (all events)

{
"event_name": "string", // e.g., "picks_viewed"
"ts_iso": "2025-09-22T14:03:02Z",
"user_id": "uuid|null", // null if guest
"profile_id": "uuid|null",
"anonymous_id": "string", // device/session id for guests
"session_id": "string", // app session
"region": "US",
"device": "ios|android|web",
"app_version": "1.0.0",
"private_mode": false,
"properties": { } // event-specific payload
}

### PII & Privacy

- Never store raw emails in event streams; use hashed IDs.
- Respect “Do Not Track” and Private Mode.
- Provide delete/export mechanisms (GDPR/CCPA).

### Core Event Catalog (MVP)

- app_open → { entrypoint: "cold|warm|push", permissions: { push:true } }
- onboarding_completed → { subscriptions_count: 3, genres_count: 5, moods_count: 3 }
- subscriptions_selected → { services:["NETFLIX","PRIME"], region:"US" }
- preferences_updated → { genres_added:["COMEDY"], disliked_genres:["HORROR"], moods:["feel_good"] }
- picks_viewed → { count: 5, request_ms: 180 }
- pick_impression → { title_id:"uuid", score:0.82, reason:"similar_to: The Bear" }
- pick_watch_now_clicked → { title_id:"uuid", provider:"NETFLIX", deep_link_used:true }
- search_performed → { q:"comedy", filters:{ providerIn:["NETFLIX"], runtimeLt:90 }, results_count:22, request_ms:120 }
- search_result_clicked → { title_id:"uuid", rank:3 }
- feedback_given → { title_id:"uuid", action:"LIKE|DISLIKE|SAVE", reason_opt:"seen" }
- list_created → { list_id:"uuid", visibility:"PUBLIC" }
- list_item_added → { list_id:"uuid", title_id:"uuid", position:7 }
- alert_set → { alert_id:"uuid", type:"availability", services:["NETFLIX"] }
- alert_fired_opened → { alert_id:"uuid", title_id:"uuid" }
- friend_request_sent / friend_request_accepted → { to_profile_id:"uuid" }

### Notes

- GraphQL schema is marked “Done” in the source but not included verbatim in the shared content; REST provides clear parity for MVP.

---

Source: https://chatgpt.com/share/68d2a160-b000-8000-90db-cee96facba18
