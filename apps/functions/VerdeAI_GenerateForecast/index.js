const axios = require("axios");
const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, myTimer) {
    try {
        context.log("Running VerdeAI_GenerateForecast...");

        // Call Azure ML endpoint
        const mlResponse = await axios.post(
            process.env.VERDEAI_ENDPOINT_URL,
            {},
            {
                headers: {
                    "Authorization": `Bearer ${process.env.VERDEAI_ENDPOINT_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const forecast = mlResponse.data;

        // Save to Cosmos DB
        const cosmos = new CosmosClient({
            endpoint: process.env.COSMOS_DB_ACCOUNT_URI,
            key: process.env.COSMOS_DB_KEY
        });

        const container = cosmos
            .database(process.env.COSMOS_DB_DATABASE)
            .container("forecasts");

        await container.items.create(forecast);

        context.log("Forecast saved successfully.");
    } catch (err) {
        context.log("Error:", err);
    }
};
