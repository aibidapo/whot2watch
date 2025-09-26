# Analytics Event Catalog (MVP → Phase 2) — Whot2Watch

> Respect Private Mode: do not emit user-linked events when enabled. Use anonymous_id for guests.
> Provide GDPR/CCPA export & delete endpoints; avoid raw emails in event streams.

## Event Envelope

```json
{
  "event_name": "string",
  "ts_iso": "2025-09-22T14:03:02Z",
  "user_id": "uuid|null",
  "profile_id": "uuid|null",
  "anonymous_id": "string",
  "session_id": "string",
  "region": "US",
  "device": "ios|android|web",
  "app_version": "1.0.0",
  "private_mode": false,
  "properties": {}
}
```

## Core Events

- app_open, onboarding_completed, subscriptions_selected
- preferences_updated, picks_viewed, pick_impression, pick_watch_now_clicked
- search_performed, search_result_clicked
- feedback_given, list_created, list_item_added
- alert_set, alert_fired_opened
- friend_request_sent, friend_request_accepted
- group_session_created, group_vote_cast, group_session_closed
- deep_link_opened, deep_link_failed
- private_mode_toggled

(See prior detailed schemas for examples.)
