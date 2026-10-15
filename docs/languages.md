# VerdeAI languages

VerdeAI supports English (`en`), Kannada (`kn`), Hindi (`hi`), French (`fr`),
and Spanish (`es`) across desktop web, installable PWA, iOS, and Android.

## Behavior

The web/Android language selector and iOS filter sheet use each language's own name.
On first use, the web and iOS check preferred languages in order; Android uses the device
formatting locale. English is the fallback. A choice is saved under
`verdeai.language` in web local storage, Android AsyncStorage, or iOS UserDefaults.
Disabled storage still allows switching for the current session. The web document's
`lang` attribute updates for assistive technology. All five supported languages use left-to-right layout.

UI copy includes panel headings, navigation, table/card labels, risk badges,
loading and empty states, recoverable errors, offline notices, chat controls,
and PWA installation instructions. Dates and numbers use `Intl` on web/Android and Foundation formatters on iOS.
API dates remain ISO calendar dates; UTC date formatting avoids changing the
selected day across time zones. Menu item and restaurant names are source data
and retain their original spelling.

The selected locale is sent with GraphQL insight queries and REST chat requests.
Both the Azure system prompt and deterministic fallback responses follow it.
Chat history and cached insights include language in their keys. Switching
language opens the matching thread; returning to a language restores its thread
for the current session. Changing language during a request keeps the resulting
reply in its original thread. Chat history is not saved across app restarts.

REST `/api/explain`, `/api/explain/chat`, standalone Azure Function
`VerdeAI_Explain`, GraphQL `insight`, and GraphQL `explainChat` accept an optional
`locale`. Existing clients default to English. Regional language codes normalize
to supported base languages; unsupported inputs fall back to English.

## Maintaining translations

- `packages/shared-types/src/index.ts`: shared supported locales and normalization.
- `packages/mobile-core/src/messages.ts`: shared, typed UI catalogs.
- `apps/web/src/i18n/messages.ts`: web re-export of the shared catalogs.
- `apps/web/src/i18n/index.ts`: language detection, persistence, and formatting.
- `apps/web/src/components/LanguageSelector.tsx`: native-language option names.
- `apps/api/src/services/localizedReply.ts`: deterministic explanations.
- `apps/api/src/services/explainService.ts`: Azure response-language instruction.
- `apps/functions/VerdeAI_Explain/index.js`: standalone Azure locale allowlist.
- `apps/ios/VerdeAI/Info.plist`: declared iOS supported languages.
- `apps/ios/VerdeAI/Models.swift`: native language detection and formatting.
- `apps/android/src/App.tsx`: Android language persistence and formatting.

Adding a language requires completing every UI message and fallback branch,
adding its option name and shared locale, declaring iOS support, and adding
service and browser coverage. SwiftUI catalogs are regenerated with `npm run mobile:resources`; Android imports
them directly. Build and run each native app using the workflow in [the mobile guide](mobile.md), using a real HTTPS API URL.

## Verification

Run `npm run test`, `npm run typecheck`, `npm run lint`, and
`npm run test:e2e -w apps/web`. Browser tests use mocked endpoints and verify
language persistence, localized navigation and risk labels, API request locales,
conversation isolation, and mobile control visibility. Service tests verify
localized fallback responses, REST/GraphQL propagation, the Azure language
instruction, and localized fallback when Azure fails. Live Azure responses,
translation review by native speakers, and physical-device keyboards are
not covered by these automated checks.
