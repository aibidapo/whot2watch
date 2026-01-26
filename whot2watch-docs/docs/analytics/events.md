# Analytics Event Catalog (MVP → Phase 2) — Whot2Watch

> Respect Private Mode: do not emit user-linked events when enabled. Use anonymous_id for guests.
> Provide GDPR/CCPA export & delete endpoints; avoid raw emails in event streams.

## Event Envelope

```
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

## AI Concierge Events (Epic 8)

- chat_message_sent: User sends message to AI Concierge
- chat_response_received: AI returns recommendations
- chat_fallback_triggered: Fallback to NLU/local DB

### Privacy Notes for AI Events

- `chat_message_sent`: Only captures message_length, detected_intent, entity_types. No raw message text.
- `chat_response_received`: Captures token counts and costs for monitoring, no response content.
- `chat_fallback_triggered`: Captures hashed error messages, no PII.

### Cost Monitoring Metrics (Epic 12)

AI events track LLM usage for cost monitoring:
- `input_tokens`, `output_tokens`: Token counts per request
- `estimated_cost_usd`: Estimated cost per response
- `llm_provider`: Provider used (anthropic/openai/none)
- `daily_usage_count`, `daily_limit`: Rate limit tracking

See JSON Schemas in this folder for payload structure.
