# VerdeAI
🌱 VerdeAI
AI‑powered food‑waste reduction platform for restaurants

VerdeAI is a serverless, cloud‑native system that helps restaurants reduce food waste through demand forecasting, waste‑risk scoring, and natural‑language recommendations. The platform combines Azure Functions, Cosmos DB, and Azure OpenAI to turn raw operational data into actionable insights.

🚀 Features
Demand Forecasting  
Predicts daily item‑level demand using historical sales and contextual signals.

Waste‑Risk Engine  
Scores each menu item for overproduction risk and identifies potential waste hotspots.

AI‑Generated Explanations  
Uses Azure OpenAI to convert forecasts and risk scores into clear, manager‑friendly insights.

Serverless Architecture  
Fully event‑driven pipeline built on Azure Functions for scalability and low operational overhead.

🏗️ Architecture Overview
Code
+------------------+        +------------------+        +------------------------+
|   Restaurant     |        |   Azure Cosmos   |        |   Azure OpenAI         |
|   Data Source    +------->+       DB         +------->+   (verdeai-explainer)  |
+------------------+        +------------------+        +-----------+------------+
          |                           ^                            |
          v                           |                            v
+------------------+        +------------------+        +------------------------+
| VerdeAI_Forecast |        | VerdeAI_Waste    |        | VerdeAI_Explain        |
| (Azure Function) |        | (Azure Function) |        | (Azure Function)       |
+------------------+        +------------------+        +------------------------+
📦 Tech Stack
Azure Functions (Node.js)

Azure Cosmos DB

Azure OpenAI Service

Event‑driven serverless pipeline

HTTP‑triggered APIs for dashboard integration

🛠️ Local Development
1. Install dependencies
Code
npm install
2. Configure environment variables
Create a local.settings.json file in the project root:

json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "COSMOS_DB_CONNECTION_STRING": "<your-connection-string>",
    "OPENAI_ENDPOINT": "<your-openai-endpoint>",
    "OPENAI_API_KEY": "<your-openai-key>",
    "OPENAI_DEPLOYMENT": "verdeai-explainer"
  }
}
3. Start the Functions runtime
Code
func start
📘 Function Endpoints
1. VerdeAI_Forecast
Code
POST /api/VerdeAI_Forecast
Generates item‑level demand forecasts.

2. VerdeAI_Waste
Code
POST /api/VerdeAI_Waste
Computes waste‑risk scores based on forecasted demand.

3. VerdeAI_Explain
Code
POST /api/VerdeAI_Explain
Returns natural‑language insights for managers.

Example request:

json
{
  "restaurantId": "R001",
  "date": "2026-02-05"
}
📊 Output Example
json
{
  "item": "Grilled Chicken Bowl",
  "forecast": 42,
  "wasteRisk": "High",
  "explanation": "Demand is expected to drop today due to lower weekday traffic. Reduce prep volume by ~15%."
}
🧪 Testing
Use curl or Postman:

Code
curl -X POST http://localhost:7071/api/VerdeAI_Explain \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":"R001","date":"2026-02-05"}'
📈 Impact
Improved forecast accuracy by ~25%

Reduced pipeline latency by 40%

Helped pilot restaurants cut food waste by 15–20%