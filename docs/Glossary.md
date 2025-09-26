# Glossary

- Title: A movie or show record. Fields include name, type (MOVIE/SHOW), releaseYear, availability.
- Availability: A record of a Title being offered by a service in a region with an offerType.
- Service: Streaming provider (e.g., NETFLIX, DISNEY_PLUS). Canonicalized via `services/catalog/providerAlias.js`.
- Region: Country/locale code where content is available (e.g., US, CA).
- Profile: A user’s viewing profile; owns lists, subscriptions, alerts.
- Subscription: A service a profile is subscribed to (service, region, active).
- List: A curated set of Titles created by a profile.
- Picks: Daily recommendations for a profile based on subscriptions and simple scoring.
- Alert: Notification intent when a Title becomes available on selected services/regions.
