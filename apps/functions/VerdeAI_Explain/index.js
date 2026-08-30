const { CosmosClient } = require("@azure/cosmos");
const axios = require("axios");

module.exports = async function (context, req) {
    try {
        const restaurantId = req.query.restaurantId || req.body.restaurantId;
        const date = req.query.date || req.body.date;

        if (!restaurantId || !date) {
            context.res = {
                status: 400,
                body: "restaurantId and date are required"
            };
            return;
        }

        // Cosmos DB setup
        const cosmos = new CosmosClient({
            endpoint: process.env.COSMOS_DB_ACCOUNT_URI,
            key: process.env.COSMOS_DB_KEY
        });

        const db = cosmos.database(process.env.COSMOS_DB_DATABASE);
        const forecasts = db.container("forecasts");
        const waste = db.container("waste_logs");

        // Fetch forecast
        const { resources: forecastData } = await forecasts.items
            .query({
                query: "SELECT * FROM c WHERE c.restaurantId=@r AND c.date=@d",
                parameters: [
                    { name: "@r", value: restaurantId },
                    { name: "@d", value: date }
                ]
            })
            .fetchAll();

        // Fetch waste risk
        const { resources: wasteData } = await waste.items
            .query({
                query: "SELECT * FROM c WHERE c.restaurantId=@r AND c.date=@d",
                parameters: [
                    { name: "@r", value: restaurantId },
                    { name: "@d", value: date }
                ]
            })
            .fetchAll();

        const prompt = `
You are VerdeAI, an AI assistant for restaurant food waste reduction.

Here is the forecast and waste risk data:
Forecast: ${JSON.stringify(forecastData)}
Waste Risk: ${JSON.stringify(wasteData)}

Write a clear, friendly explanation for the restaurant manager.
`;

        const response = await axios.post(
            `${process.env.AZURE_OPENAI_ENDPOINT}openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-02-15-preview`,
            {
                messages: [{ role: "user", content: prompt }],
                max_tokens: 300
            },
            {
                headers: {
                    "api-key": process.env.AZURE_OPENAI_API_KEY,
                    "Content-Type": "application/json"
                }
            }
        );

        const explanation = response.data.choices[0].message.content;

        context.res = {
            status: 200,
            body: {
                restaurantId,
                date,
                explanation
            }
        };
    } catch (err) {
        context.log("🔥 ERROR DETAILS:", err.message);
        context.log("🔥 FULL ERROR:", JSON.stringify(err, null, 2));
        context.res = {
            status: 500,
            body: "Error generating explanation"
        };
    }
};
