# VerdeAI mobile apps

VerdeAI has three interfaces connected to the same REST/GraphQL API:

| Target | Implementation | Location |
| --- | --- | --- |
| iPhone / iPad | SwiftUI, URLSession, native navigation and date picker | `apps/ios` |
| Android | React Native 0.88, TypeScript, Material 3 controls, Kotlin host | `apps/android` |
| Web / installable PWA | React, Vite, Tailwind | `apps/web` |

Both native apps support restaurant/date selection, demand forecasts, historical
averages, high/low waste risk, localized AI insights and multi-turn chat. Language
preferences persist on the device. Conversations are kept in memory separately
for every restaurant, calendar day, and language. Failed sends retain the question
for retry without adding duplicate turns. Native layouts switch to side navigation
at tablet widths and respect safe areas and keyboard insets.

English, Kannada, Hindi, French, and Spanish catalogs live in
`packages/mobile-core/src/messages.ts`. Web and Android import the catalog directly;
`npm run mobile:resources` generates the matching JSON for SwiftUI. Android shares
the TypeScript API types; Swift uses Codable models tested against the same payloads.

## API configuration

The public API origin is in `packages/mobile-core/config.json` and initially points
to `https://verdeai-api-adb362e8.azurewebsites.net`. Change `apiUrl` to another public
HTTPS origin if needed, then run:

```sh
npm install
npm run mobile:resources
```

Rebuild each app after changing the endpoint. No backend credentials belong in this
file or either client. The API origin must have no path, credentials, query, or
fragment. Native requests use the system network stack; browser-origin CORS rules
are only relevant to the web/PWA.

`npm run deploy:azure` updates this public configuration and SwiftUI resources only
after the deployed endpoint passes its health check. It does not build, sign, or
publish the native apps. See [hosting](hosting.md).

Both native apps initially select **February 5, 2026**, matching the web dashboard's
seeded demo data. Select a different date using the native date picker for live
data. The data-source label comes from `/api/health`; it never assumes live data.

## iOS: SwiftUI

Requires Xcode with the iOS platform and at least one simulator runtime installed
from **Xcode → Settings → Components**. The deployment target is iOS/iPadOS 17.

```sh
npm run mobile:ios
```

This regenerates resources and opens `apps/ios/VerdeAI.xcodeproj`. Choose the VerdeAI
scheme and an iPhone/iPad simulator, then Run. For a physical device, configure your
Apple development team under Signing & Capabilities.

For a command-line simulator build:

```sh
xcodebuild -project apps/ios/VerdeAI.xcodeproj -scheme VerdeAI \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath dist/ios-derived CODE_SIGNING_ALLOWED=NO build
```

The filter button opens native restaurant, date, and language controls. iPhone uses
a system tab bar; iPad uses a split-view sidebar. Lists support pull to refresh.

## Android: React Native

Requires a supported Node version (see `apps/android/package.json`), JDK 17 or a
compatible JDK, Android Studio, and the SDK/NDK versions declared in
`apps/android/android/build.gradle`. Set `ANDROID_HOME` to the installed SDK and put
its `platform-tools` on `PATH`. Alternatively set `sdk.dir` in the ignored file
`apps/android/android/local.properties`. Start an emulator or connect a USB device.

Run Metro and the Android app in separate terminals from the repository root:

```sh
npm run mobile:start
```

```sh
npm run mobile:android
```

Open `apps/android/android` in Android Studio for native debugging. Gradle and Metro
are configured for this npm-workspaces monorepo. The application ID remains
`com.verdeai.app`.

```sh
npm run build:android -w apps/android
npm run bundle:android -w apps/android
```

The first command builds a debug APK (requires the Android SDK). The second
validates and exports the production JavaScript bundle and fonts to `dist/android`
without requiring an SDK. Debug uses the template development keystore. Release
artifacts are unsigned until you configure a private release key; no debug key is
used for release signing.

## Web / PWA

Run `npm run dev` at the root, or build with `npm run build -w apps/web`.
On HTTPS, Safari offers Share → Add to Home Screen; Android/desktop browsers offer
Install when supported. The service worker caches application files; fresh data
and AI responses require connectivity. Native apps bundle their own UI and also
require connectivity for fresh data. Chat history is not persisted across restarts.

## Verification

```sh
npm run typecheck
npm run test
npm run lint -w apps/web
npm run build -w apps/web
npm run test:e2e -w apps/web
npm run bundle:android -w apps/android
swift test --package-path apps/ios
```

The TypeScript and Swift API tests cover localized GraphQL variables, chat history,
HTTP/GraphQL failure handling, and calendar-date formatting. TypeScript also covers
request cancellation and API-origin validation. Browser tests exercise the web
dashboard; they do not verify native rendering.

Migration verification on this machine: SwiftUI source type checking against the
iOS simulator SDK, five Swift API/model tests, 45 TypeScript tests (31 API, 8 web,
6 shared mobile-client), all TypeScript checks, web lint/build, 30 browser tests,
and the Android production JS/font bundle passed. Full Xcode builds and simulator screenshots are
blocked by missing iOS platform/runtime components. Android APK/emulator checks
require the Android SDK. Complete phone/tablet rendering, accessibility/font-size,
keyboard, rotation, gesture, and physical-device checks after installing those
components. Signing, store listings, and submission remain release work.

The previous untracked Capacitor projects were preserved locally in the ignored
`dist/legacy-capacitor` directory during migration. They are no longer part of the
app build or deployment workflow.

Reference setup: [React Native environment](https://reactnative.dev/docs/set-up-your-environment)
and [Metro](https://reactnative.dev/docs/metro).
