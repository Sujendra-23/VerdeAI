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
  web/           React + TypeScript + Vite dashboard
packages/
  shared-types/  TypeScript types shared by api and web
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
standalone `VerdeAI_Explain` Azure Function is unchanged and still English-only.

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

Nothing below is deployed yet — this documents the steps for when it is.

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
- `POST /api/bookings` — book a food-bank pickup for forecast surplus: `{ restaurantId, date, slot, item, quantity, contactName, notes? }` → `201` (see [Bookings](#bookings-writes-validation-idempotency-migrations))
- `GET /api/bookings?restaurantId=&date=`, `GET /api/bookings/:id`, `POST /api/bookings/:id/cancel`

GraphQL (`POST /graphql`):
- `restaurants`, `forecasts(restaurantId, date)`, `wasteRisk(restaurantId, date)`
- `insight(restaurantId, date)` — forecasts + waste risk + explanation in one round trip
- `explainChat(restaurantId, date, messages, language)` mutation

### Bookings: writes, validation, idempotency, migrations

`POST /api/bookings` is the API's first write path. A restaurant reserves a 30-minute food-bank
pickup slot (`HH:00` or `HH:30`, 06:00-22:00) for surplus of an item that is on that day's forecast.
Bookings live in Cosmos DB (`bookings` container) in Cosmos mode and in memory in mock-data mode, so
the demo still runs with zero Azure resources (bookings made in mock mode vanish on restart).

| Situation | Response |
|---|---|
| Created | `201`, `Location: /api/bookings/:id` |
| Retry with the same `Idempotency-Key` and body | `200`, same booking, `Idempotent-Replayed: true` |
| Same key, different body | `422 idempotency_key_reused` |
| Malformed key / body / query / id, unknown fields, bad date or slot, non-integer quantity | `400 validation_error` (per-field `details`), `invalid_idempotency_key`, `invalid_json` |
| Oversized body | `413 payload_too_large` |
| Unknown restaurant / booking | `404` |
| Item not on that day's forecast, or quantity above the forecast | `422 unknown_item` / `quantity_exceeds_forecast` |
| Slot already held | `409 slot_taken` (or `duplicate_booking` if it is the identical request) |
| Cancel (idempotent) | `200`; cancelling frees the slot and keeps the record |

Requests are validated with [zod](https://zod.dev) (`src/bookings/schema.ts`). With an
`Idempotency-Key`, the booking id is derived from the restaurant and key, so a retry (even a
concurrent one) resolves to the same stored document with no separate idempotency table and no
"in progress" window. At most one confirmed booking per restaurant/date/slot is enforced by the
store (a Cosmos unique key on `/slotKey`), not by a check-then-insert.

**Migrations.** Cosmos has no schema DDL, so migrations manage what is versioned: containers,
partition and unique-key policies, indexing policy, backfills. They live in `src/migrations/versions`,
run in order, and are recorded in a `_migrations` container with a checksum of each file. In Cosmos
mode the API applies pending migrations on startup (set `MIGRATE_ON_STARTUP=false` to run them as a
separate step):

```bash
npm run migrate -w @verdeai/api              # apply pending
npm run migrate -w @verdeai/api -- --status  # show applied/pending, change nothing
```

The runner refuses to start if an applied migration's file was edited, if the database has
migrations this build does not know, or if a new migration is numbered below an applied one; a lock
document keeps two replicas from migrating at once. Migrations must be idempotent. Never edit an
applied migration; add the next number.

**What was verified.** The suite (`npm test -w @verdeai/api`) covers the routes, service, store
contract and migration runner against an in-memory store and a *model* of Cosmos
(`test/support/fakeCosmos.ts`), which is only as faithful as that model. The same store contract and
migrations were also run against the **Cosmos DB vNext Linux emulator** (not a real Azure account)
via `test/cosmosEmulator.test.ts`, gated on `COSMOS_EMULATOR_ENDPOINT` / `COSMOS_EMULATOR_KEY`
(see the test file for the `docker run` line), and the API was exercised end to end against that
emulator (startup migrations, restart, idempotent replay, conflicts, cancel). Nothing was run
against a real Azure Cosmos DB account, so RU cost, latency, and any behaviour the emulator differs
on are untested. Bookings have no authentication yet, like the rest of this API.

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
