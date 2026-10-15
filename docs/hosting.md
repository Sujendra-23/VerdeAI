# HTTPS hosting for VerdeAI

The Azure deployment package hosts the React web application and the REST/GraphQL
API together on one HTTPS origin. iOS and Android use that same API origin.
The deployment script targets a Linux **F1 Free** App Service plan; it never
upgrades an existing plan to a paid tier. This is a demo/development tier with
usage limits and cold starts, not a production availability guarantee.

## Deployed address

Web application and API: [https://verdeai-api-adb362e8.azurewebsites.net](https://verdeai-api-adb362e8.azurewebsites.net).

- Resource group: `verdeai-web-mobile`
- Plan: `verdeai-free-linux` (Linux F1 Free)
- App: `verdeai-api-adb362e8`
- Runtime: Node 22 LTS, HTTPS-only, minimum TLS 1.2

Public verification passed for the dashboard root, PWA manifest, REST health and
restaurants, GraphQL insights and REST chat in all five languages, and native
CORS access in the previous Capacitor implementation. The native app configuration
now defaults to this URL; these historical checks do not verify the new native apps. `/api/health` currently reports `dataSource: "mock"`; explanations use the
localized template fallback. These checks verify public hosting and client
configuration, not physical-device execution or app-store distribution.

## Deploy

From the repository root:

```sh
az login
npm run deploy:azure
```

The script uses the active Azure subscription. Default resource names:

- Resource group: `verdeai-web-mobile`
- Linux F1 plan: `verdeai-free-linux`
- App: `verdeai-api-<first segment of the subscription ID>`
- Region: `westus2`

Override them with `VERDEAI_AZURE_GROUP`, `VERDEAI_AZURE_PLAN`,
`VERDEAI_AZURE_APP`, and `VERDEAI_AZURE_LOCATION` as needed.
The actual HTTPS hostname is read from Azure rather than guessed.

The script builds the web application, bundles the API and shared TypeScript,
installs only API runtime dependencies in an isolated staging directory, and
creates `dist/verdeai-azure.zip`. It enables HTTPS-only access and TLS 1.2,
sets the Node 22 startup command, and uploads the package.
No local `.env` files, Azure login credentials, or backend keys are copied.

After the deployed `/api/health` endpoint responds successfully, the script
updates `VITE_API_URL` in the ignored web `.env.production.local` file, writes
the public API origin to `packages/mobile-core/config.json`, and regenerates
the SwiftUI bundle resources. Android imports the same configuration through Metro.
Rebuild native apps to ship a changed endpoint. Other web environment settings remain
intact. The verified URL and resource names are recorded in ignored
`dist/azure-deployment.json`. If provisioning or health verification fails,
client URL settings are not changed to an unverified endpoint.

## Verify

Open the returned HTTPS URL to use the dashboard. Check `/api/health`,
`/api/restaurants`, and POST `/graphql`. Use the dashboard language selector to
check localized forecasts, risk labels, and AI explanations. Then run the mobile
projects using [the mobile guide](mobile.md).

The initial deployment serves the existing seeded demo data and deterministic
localized explanation fallback. It does not provision Cosmos DB, Azure OpenAI,
or the nightly forecasting pipeline. To connect those later, configure their
backend environment variables securely in Azure App Service. Never put backend
credentials in `VITE_*` values: those are bundled into public client assets.

## Package without deploying

```sh
npm run build -w apps/web
npm run package:azure -w apps/api
PORT=4100 STATIC_DIR="$PWD/dist/azure/public" node dist/azure/server.cjs
```

This serves the exact deployment package locally at `http://localhost:4100`.
Packaging does not create cloud resources. Local checks cover the web root,
PWA manifest, REST health/restaurants, localized GraphQL explanations, and
native-origin CORS. Actual cloud deployment still requires a valid Azure login.

See Microsoft's [Node.js App Service quickstart](https://learn.microsoft.com/en-us/azure/app-service/quickstart-nodejs)
and [ZIP package deployment guide](https://learn.microsoft.com/en-us/azure/app-service/deploy-run-package).
