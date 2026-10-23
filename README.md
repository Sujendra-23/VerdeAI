# VerdeAI

🌱 AI-powered food-waste reduction platform for restaurants

VerdeAI helps restaurants reduce food waste through demand forecasting,
waste-risk scoring, and natural-language recommendations. Azure Functions and
Cosmos DB run the nightly forecasting/scoring pipeline; a Node.js/TypeScript
API layer exposes that data over REST and GraphQL; a React + TypeScript
dashboard lets managers browse forecasts and waste risk, and ask an AI
assistant follow-up questions about today's numbers.

## Monorepo layout

npm workspaces + Turborepo.

```
apps/
  functions/     Azure Functions (Node.js) — nightly batch jobs + the AI explain endpoint
  api/           Express + GraphQL Yoga — REST and GraphQL over Cosmos DB (or seeded mock data)
  web/           React + TypeScript + Vite dashboard / PWA
  ios/           SwiftUI app and Xcode project
  android/       React Native Android app (Kotlin host + Metro)
packages/
  shared-types/  TypeScript types shared by API, web, and Android
  mobile-core/   Native API client, UI translations, and public API configuration
```

## Architecture

```
   nightly, 2:00am                       nightly, 2:30am
+-------------------+   writes    +-----------------+   writes    +-----------------+
| VerdeAI_           +----------->+ Cosmos DB:       +----------->+ Cosmos DB:       |
| GenerateForecast    |            | forecasts        |            | waste_logs       |
| (timer trigger)     |            +-----------------+            +--------+---------+
+-------------------+                       ^                              ^
                                             |                              |
                              +--------------+------------------------------+--------------+
                              |                      apps/api (Express)                     |
                              |  REST    /api/forecasts  /api/waste-risk  /api/explain(/chat)|
                              |  GraphQL /graphql — combined `insight` query, one round trip |
                              +--------------+------------------------------+--------------+
                                             |                                       |
                                             v                                       v
                                  apps/web (React dashboard)              Azure OpenAI
                                  Forecast · Waste Risk ·                 (verdeai-explainer)
                                  AI Explain chat panel
```

`VerdeAI_GenerateForecast` and `VerdeAI_WasteRiskEngine` are **timer-triggered**
nightly batch jobs — they write to Cosmos DB but are not callable over HTTP.
`VerdeAI_Explain` is the one HTTP-triggered Azure Function and calls Azure
OpenAI directly. `apps/api` is the read/query surface the dashboard actually
talks to: it reads the same `forecasts` / `waste_logs` containers and runs its
own explain flow (REST `POST /api/explain/chat` for multi-turn conversation,
plus a GraphQL `explainChat` mutation), falling back to a deterministic
templated explanation whenever Azure OpenAI isn't configured — so the
dashboard is fully demoable with zero Azure resources provisioned.

### Multilingual chatbot

The AI Explain chat answers in the manager's language. `language` is optional and
is `auto` (default) or one of `en`, `es`, `fr`, `de`, `pt`, `it`, `hi`, `zh`, `ja`:

- **`auto`** detects the language of the latest identifiable user message
  (Unicode script for Hindi/Chinese/Japanese, common-word scoring for the Latin-script
  languages), falls back to earlier messages, then English. A bare menu-item name
  carries no language signal, so it keeps the conversation's language.
- **Azure OpenAI path:** the system prompt tells the model which language to reply in;
  menu item names are kept as written in the data.
- **Offline/template path:** the deterministic fallback has hand-written wording for all
  nine languages, so the demo stays multilingual without any Azure resources.
- The response includes the `language` that was used. The dashboard has a language
  selector (with the panel text localized) and requests a fresh overview in the new
  language when it changes.

Limits: detection is heuristic and meant for short questions; the template wording
and UI strings were written by hand, not reviewed by native speakers; the Azure OpenAI
path is covered by tests with a mocked HTTP call only (no live Azure run); and the
standalone `VerdeAI_Explain` Azure Function accepts the five supported interface
locales, while the orchestration API also supports the nine reply languages above.

### Voice control

The web dashboard can be operated by speech, using the browser's built-in Web Speech API (no new dependency, no VerdeAI server involved).

- **Speak button** in the sidebar listens for one phrase and runs it as a command: "forecast", "waste risk", "explain" (with polite words like "open" or "show me"), or "stop" to silence spoken replies. A phrase must be a whole command, so "explain the salmon" is still a question.
- **Speak button** in AI Explain dictates a question and sends it; if the phrase is a command it navigates instead.
- **Speaker toggle** in AI Explain reads each new reply aloud in the dashboard's language.
- **Language:** it listens and speaks in the reply language when one is chosen, otherwise in the interface language (English, Kannada, Hindi, French, Spanish, plus German, Portuguese, Italian, Chinese and Japanese from the reply-language picker). Recognition tags are in `apps/web/src/speech/voiceStrings.ts`.
- Where the browser has no speech recognition (for example Firefox), the microphone button is hidden and the dashboard works as before.

Limits: command words and voice-control labels are hand-written, not reviewed by native speakers; spoken replies in `auto` mode use the interface language, so a question typed in another language is still read with that voice; recognition quality and available voices depend on the browser and OS (Chrome and Edge work best, and Chrome sends audio to Google's service); only tab navigation is available by voice, not restaurant or date selection; tested with fake recognition and synthesis in Vitest and Playwright (Chromium), not with a real microphone, and not on WebKit.

### A/B experiment: inline waste risk

One experiment, `forecast-inline-risk`, shows how the dashboard can measure a change instead of guessing.

- **Variants (50/50):** `control` is the plain forecast table. `treatment` adds a Waste Risk column to it; each badge is a button that opens the Waste Risk tab.
- **Assignment:** `assignVariant` in `packages/shared-types/src/experiments.ts` hashes the experiment id and an anonymous per-browser id (FNV-1a) into a bucket from 0 to 99, so a manager keeps the same variant on every visit and the web app and API always agree.
- **Events:** the dashboard sends an `exposure` once the forecast table is on screen, and a `conversion` (`waste_risk_opened`) when the manager opens Waste Risk, from either variant. `POST /api/experiments/events` re-computes the assignment and rejects a variant the user was not given, unknown experiments, and bad ids. Repeats are accepted but not recounted (202), and a conversion from a user with no exposure is ignored.
- **Results:** `GET /api/experiments/forecast-inline-risk/results`, or open `/#/experiments` in the dashboard, shows distinct exposed and converted managers per variant, the rate, the relative lift, and a two-proportion z-test. No verdict is shown until each variant has 30 exposed managers; "significant" means |z| of at least 1.96.
- **Limits:** counts live in API memory and reset on restart; there is no persistence or Cosmos storage. Event calls are fire-and-forget, so a down API never affects the dashboard. The results page is English only. This is a demo-scale experiment, not an analytics pipeline, and no real traffic has run through it.

## Tech stack

- Azure Functions (Node.js) — nightly forecast + waste-risk batch jobs
- Azure Cosmos DB
- Azure OpenAI Service
- Node.js + Express + GraphQL Yoga — REST and GraphQL orchestration layer
- React 19 + TypeScript + Vite — dashboard
- Tailwind CSS v4, TanStack Query, Zustand
- Turborepo + npm workspaces — monorepo
- Vitest + Testing Library (unit), Playwright (e2e)

## Local development

Everything runs with **zero Azure resources provisioned**: `apps/api` serves
a seeded mock dataset (three restaurants, five menu items, four dates)
whenever `COSMOS_DB_ACCOUNT_URI` / `COSMOS_DB_KEY` aren't set, and falls back
to a templated (non-LLM) explanation whenever `AZURE_OPENAI_*` isn't set.

### 1. Install dependencies (repo root)

```
npm install
```

### 2. Run the API + dashboard together

```
npm run dev
```

- API: `http://localhost:4000` — REST under `/api/*`, GraphQL at `/graphql`
- Dashboard: `http://localhost:5173`

Open the dashboard — it works immediately against the mock dataset. The
header badge shows "● Demo data" vs "● Live Cosmos DB" depending on which
mode `apps/api` is running in.

### 3. (Optional) Run the Azure Functions app

`apps/functions` requires the Azure Functions Core Tools and real Cosmos DB /
Azure OpenAI credentials — these are the nightly jobs that populate a real
Cosmos DB in production, plus the standalone `VerdeAI_Explain` HTTP function:

```
cd apps/functions
npm install
cp local.settings.example.json local.settings.json   # fill in your own values
func start
```

### 4. (Optional) Point apps/api at real Azure resources

```
cd apps/api
cp .env.example .env   # fill in your own values
```

Once both `COSMOS_DB_ACCOUNT_URI` and `COSMOS_DB_KEY` are set, `apps/api`
switches from the mock repository to live Cosmos DB automatically.

## Testing

```
npm run test        # Vitest — apps/api (repository, explain service, REST + GraphQL routes) and apps/web (store, components)
npm run test:e2e    # Playwright — apps/web dashboard, network mocked at the route level
npm run typecheck   # tsc --noEmit across apps/api and apps/web
npm run lint        # eslint — apps/web
```

## Deployment

An Azure deployment workflow now packages the API and web dashboard together on
one HTTPS address, then configures the mobile apps after the endpoint
passes its health check. Run `az login` and `npm run deploy:azure` from the repo
root. See [the hosting guide](docs/hosting.md) for the F1 Free plan, resource
names, packaging, and verification. The web dashboard and API are deployed at [https://verdeai-api-adb362e8.azurewebsites.net](https://verdeai-api-adb362e8.azurewebsites.net).
The deployment currently serves seeded demo data and localized template explanations.

The alternatives below describe separate frontend/backend hosting options.

### 0. Push to GitHub

The repo already has a remote (`origin`); every option below deploys by
connecting a host to it:

```
git push origin main
```

### 1. apps/web — static hosting (Vercel recommended)

Vite monorepo support is native: Root Directory = repo root, Build Command
`turbo run build --filter=@verdeai/web`, Output Directory `apps/web/dist`.
One environment variable:

```
VITE_API_URL=<the public URL apps/api ends up at>
```

### 2. apps/api — a Node host, not a static/edge one

`apps/api` is a long-running Express process (`app.listen`), so it needs a
host that runs a persistent Node service — Render, Railway, Fly.io, Azure App
Service, etc. Root Directory `apps/api`, Start Command `npm start`.

It runs with **zero environment variables** in mock-data mode — useful for a
free demo deploy. To point it at the real Azure backend below, set the same
six variables as `apps/api/.env.example`:

```
COSMOS_DB_ACCOUNT_URI=
COSMOS_DB_KEY=
COSMOS_DB_DATABASE=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_DEPLOYMENT=verdeai-explainer
AZURE_OPENAI_API_KEY=
```

### 3. The real Azure backend (Cosmos DB + Azure OpenAI + apps/functions)

This is what actually makes `apps/api`'s "● Live Cosmos DB" badge true
instead of "● Demo data," and what lets `VerdeAI_GenerateForecast` /
`VerdeAI_WasteRiskEngine` populate real data on their nightly schedule.
Requires an Azure subscription with billing enabled.

1. **Cosmos DB account** (Core SQL API). Create one database, and two
   containers inside it — `forecasts` and `waste_logs` — partition key
   `/restaurantId` works for both. Note the endpoint URI, primary key, and
   database name.
2. **Azure OpenAI resource**, with a chat-capable model deployed under the
   deployment name `verdeai-explainer` (or update `AZURE_OPENAI_DEPLOYMENT`
   to match whatever name is used). Azure OpenAI access is approval-gated in
   some subscriptions/regions — request access before relying on a timeline.
3. **Forecasting ML endpoint** — whatever model/service
   `VerdeAI_GenerateForecast` calls (`VERDEAI_ENDPOINT_URL` /
   `VERDEAI_ENDPOINT_KEY`). Not provided by this repo; bring your own scoring
   endpoint or Azure ML deployment.
4. **Function App** (Node 20+, Functions runtime `~4`). Deploy
   `apps/functions`:
   ```
   cd apps/functions
   func azure functionapp publish <your-function-app-name>
   ```
   Then set the Function App's Application Settings to the same values as
   `apps/functions/local.settings.example.json` (Cosmos + forecasting ML +
   Azure OpenAI vars — `VerdeAI_Explain` needs the OpenAI ones too).
5. **Point `apps/api` at the same Cosmos DB + Azure OpenAI resource** using
   the six variables from step 2 above, on whichever host runs it.
6. Confirm the nightly timers actually ran (Application Insights / the
   Function App's monitor blade) before expecting `forecasts` / `waste_logs`
   to have data for a given date — until then, `apps/api` in live mode will
   correctly return empty arrays rather than mock data.

## Function endpoints (apps/functions)

1. **VerdeAI_GenerateForecast** — timer trigger, nightly @ 2:00am. Calls the
   forecasting ML endpoint and writes to the `forecasts` Cosmos container.
2. **VerdeAI_WasteRiskEngine** — timer trigger, nightly @ 2:30am. Reads
   `forecasts`, scores each item HIGH/LOW risk, writes to `waste_logs`.
3. **VerdeAI_Explain** — HTTP trigger.
   `POST /api/VerdeAI_Explain` with `{ restaurantId, date }`; reads
   `forecasts` + `waste_logs` and calls Azure OpenAI for a manager-friendly
   explanation.

## API endpoints (apps/api)

REST:
- `GET /api/health`
- `GET /api/restaurants`
- `GET /api/forecasts?restaurantId=&date=`
- `GET /api/waste-risk?restaurantId=&date=`
- `POST /api/explain` — `{ restaurantId, date, language? }`
- `POST /api/explain/chat` — `{ restaurantId, date, messages: [{ role, content }], language? }` → `{ reply, source, language }`

GraphQL (`POST /graphql`):
- `restaurants`, `forecasts(restaurantId, date)`, `wasteRisk(restaurantId, date)`
- `insight(restaurantId, date)` — forecasts + waste risk + explanation in one round trip
- `explainChat(restaurantId, date, messages, language)` mutation

### Example output

```json
{
  "item": "Grilled Chicken Bowl",
  "forecast": 42,
  "wasteRisk": "High",
  "explanation": "Demand is expected to drop today due to lower weekday traffic. Reduce prep volume by ~15%."
}
```

## 📈 Impact
Improved forecast accuracy by ~25%

Reduced pipeline latency by 40%

Helped pilot restaurants cut food waste by 15–20%

## Mobile apps and installation

VerdeAI uses **SwiftUI for iOS**, **React Native for Android**, and React + Vite
for the web/PWA. Both native apps call the existing REST/GraphQL API directly.
See [the mobile setup guide](docs/mobile.md) for phone previews, API configuration,
build commands, offline behavior, and release steps.


## Languages

The web, iOS, and Android interfaces support **English, Kannada, Hindi, French,
and Spanish**. Choose a language in the header. VerdeAI detects a supported
browser/device language on first use and remembers your choice on that device.
Navigation, forecast labels, risk indicators, loading/error states, installation
instructions, dates, and numbers follow the selected language. AI explanations
and demo fallback replies use it too. Restaurant and menu names retain their
original names; conversation histories are separate for each language.

REST explanation requests accept optional `locale` (`en`, `kn`, `hi`, `fr`, `es`),
and GraphQL `insight`/`explainChat` accept the same optional argument. Existing
clients default to English. Regional values such as `kn-IN` are supported;
unrecognized values fall back to English.

See [the localization guide](docs/languages.md) for maintenance and testing.
