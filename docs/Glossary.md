# Glossary

Canonical domain terms for the Whot2Watch platform. PRs introducing new exports should reference this glossary and use these terms consistently in type names and public APIs.

## Core Entities

- **Title**: A movie or show record. Fields include name, type (MOVIE/SHOW), releaseYear, availability.
- **Availability**: A record of a Title being offered by a service in a region with an offerType.
- **Service**: Streaming provider (e.g., NETFLIX, DISNEY_PLUS). Canonicalized via `services/catalog/providerAlias.js`.
- **Region**: Country/locale code where content is available (e.g., US, CA).
- **OfferType**: Classification of how a Title is offered — FLATRATE (included with subscription), RENT, BUY, FREE, or ADS.
- **Profile**: A user's viewing profile; owns lists, subscriptions, alerts.
- **Subscription**: A service a profile is subscribed to (service, region, active).
- **List**: A curated set of Titles created by a profile.
- **ListItem**: An entry in a List linking a Title with an optional position and note.
- **Picks**: Daily recommendations for a profile based on subscriptions and simple scoring.
- **Alert**: Notification intent when a Title becomes available on selected services/regions.

## Social & Collaboration

- **Friend**: A directional relationship between two Profiles (status: REQUESTED or ACCEPTED).
- **GroupSession**: A collaborative watch-decision session hosted by a Profile (status: open, locked, closed).
- **Vote**: A Profile's preference for a Title within a GroupSession (voteValue integer).

## Feedback & Intelligence

- **Feedback**: A Profile's reaction to a Title (action: LIKE, DISLIKE, SAVE) with optional reason.
- **Recommendation**: A scored suggestion of a Title for a Profile, with a reason string.
- **ExternalRating**: A rating from an external source (IMDB, ROTTEN_TOMATOES, METACRITIC) for a Title.
- **TrendingSignal**: A popularity signal for a Title from an external source (TMDB_DAY, TMDB_WEEK, TRAKT_WEEK).
