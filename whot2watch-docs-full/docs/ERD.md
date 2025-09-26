# ERD (Mermaid)

```mermaid
erDiagram
    USERS ||--o{ PROFILES : has
    PROFILES ||--o{ SUBSCRIPTIONS : has
    PROFILES ||--o{ FEEDBACK : gives
    PROFILES ||--o{ RECOMMENDATIONS : receives
    PROFILES ||--o{ ALERTS : sets
    PROFILES ||--o{ LISTS : owns
    LISTS ||--o{ LIST_ITEMS : contains
    PROFILES ||--o{ FRIENDS : connects
    PROFILES ||--o{ GROUP_SESSIONS : hosts
    GROUP_SESSIONS ||--o{ VOTES : collects
    TITLES ||--o{ AVAILABILITY : has
    TITLES ||--o{ LIST_ITEMS : appear_in
    TITLES ||--o{ FEEDBACK : receives
    TITLES ||--o{ RECOMMENDATIONS : recommended_as

    USERS {
      uuid id PK
      text email
      text auth_provider
      text region
      timestamptz created_at
    }

    PROFILES {
      uuid id PK
      uuid user_id FK
      text name
      text avatar_url
      jsonb preferences
      boolean private_mode_default
      timestamptz created_at
    }

    SUBSCRIPTIONS {
      uuid id PK
      uuid profile_id FK
      text service
      text region
      boolean active
      timestamptz created_at
    }

    TITLES {
      uuid id PK
      bigint tmdb_id
      text type
      text name
      int release_year
      int runtime_min
      text[] genres
      text[] moods
      jsonb cast
      text poster_url
      text backdrop_url
      timestamptz created_at
    }

    AVAILABILITY {
      uuid id PK
      uuid title_id FK
      text service
      text region
      text offer_type
      text deep_link
      timestamptz last_seen_at
    }

    RECOMMENDATIONS {
      uuid id PK
      uuid profile_id FK
      uuid title_id FK
      float score
      text reason
      timestamptz created_at
    }

    FEEDBACK {
      uuid id PK
      uuid profile_id FK
      uuid title_id FK
      text action
      text reason_opt
      timestamptz ts
    }

    ALERTS {
      uuid id PK
      uuid profile_id FK
      uuid title_id FK NULL
      text alert_type
      text[] services
      text region
      text status
      timestamptz created_at
    }

    LISTS {
      uuid id PK
      uuid profile_id FK
      text name
      text visibility
      text description
      timestamptz created_at
    }

    LIST_ITEMS {
      uuid id PK
      uuid list_id FK
      uuid title_id FK
      uuid added_by_profile_id FK
      int position
      text note
      timestamptz added_at
    }

    FRIENDS {
      uuid id PK
      uuid profile_id FK
      uuid friend_profile_id FK
      text status
      timestamptz created_at
    }

    GROUP_SESSIONS {
      uuid id PK
      uuid host_profile_id FK
      text name
      jsonb constraints
      text status
      timestamptz created_at
    }

    VOTES {
      uuid id PK
      uuid session_id FK
      uuid profile_id FK
      uuid title_id FK
      int vote_value
      timestamptz ts
    }
```
