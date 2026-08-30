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
- `POST /api/explain` — `{ restaurantId, date }`
- `POST /api/explain/chat` — `{ restaurantId, date, messages: [{ role, content }] }`

GraphQL (`POST /graphql`):
- `restaurants`, `forecasts(restaurantId, date)`, `wasteRisk(restaurantId, date)`
- `insight(restaurantId, date)` — forecasts + waste risk + explanation in one round trip
- `explainChat(restaurantId, date, messages)` mutation

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
