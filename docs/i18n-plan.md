# Internationalization (i18n) Plan

## Library

**`next-intl`** — chosen for best Next.js App Router integration, ICU MessageFormat support, and type-safe message keys.

## Locales

| Locale | Language | Priority |
|--------|----------|----------|
| `en`   | English  | Default  |
| `es`   | Spanish  | Phase 2  |
| `fr`   | French   | Phase 2  |
| `de`   | German   | Phase 3  |
| `pt`   | Portuguese | Phase 3 |

## Message Format

ICU MessageFormat via `next-intl`. Messages stored as JSON files per locale:

```
messages/
  en.json
  es.json
  fr.json
  de.json
  pt.json
```

Example message:

```json
{
  "search.placeholder": "Search titles...",
  "picks.heading": "Daily Picks",
  "subscriptions.addAll": "Add all for {region}",
  "results.count": "{count, plural, =0 {No results} one {# result} other {# results}}"
}
```

## Phased Rollout

### Phase 1 — Foundation

- Install `next-intl`
- Configure middleware for locale detection (Accept-Language header, cookie)
- Set up `messages/en.json` with all existing UI strings
- Add `NextIntlClientProvider` to root layout
- Replace hardcoded strings with `useTranslations()` in client components and `getTranslations()` in server components

### Phase 2 — Locale Routing

- Add `[locale]` segment to app router (`app/[locale]/...`)
- Implement locale switcher component in header
- Create `es.json` and `fr.json` translations
- Add `hreflang` alternate links to metadata
- Update sitemap to include locale variants

### Phase 3 — Full Translations

- Add `de.json` and `pt.json`
- Localize date/number formatting via `useFormatter()`
- Localize region names and streaming service display names
- Add RTL layout support infrastructure (for future Arabic/Hebrew)

## Key Decisions

- **Default locale:** `en` (no prefix in URL)
- **Locale detection:** Accept-Language header with cookie override
- **Fallback:** Missing keys fall back to `en`
- **Content:** UI strings only; title/movie data remains in original language from TMDB
- **SEO:** Each locale gets its own URL prefix and `hreflang` tags
