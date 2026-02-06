const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, myTimer) {
    try {
        context.log("Running VerdeAI_WasteRiskEngine...");

        const cosmos = new CosmosClient({
            endpoint: process.env.COSMOS_DB_ACCOUNT_URI,
            key: process.env.COSMOS_DB_KEY
        });

        const db = cosmos.database(process.env.COSMOS_DB_DATABASE);
        const forecasts = db.container("forecasts");
        const waste = db.container("waste_logs");

        // Get all forecasts for today
        const { resources: forecastData } = await forecasts.items
            .query("SELECT * FROM c")
            .fetchAll();

        for (const item of forecastData) {
            const riskScore = item.predictedQuantity > item.historicalAverage * 1.2 ? "HIGH" : "LOW";

            const wasteRecord = {
                id: `${item.restaurantId}-${item.date}-${item.item}`,
                restaurantId: item.restaurantId,
                date: item.date,
                item: item.item,
                predictedQuantity: item.predictedQuantity,
                riskScore
            };

            await waste.items.create(wasteRecord);
        }

        context.log("Waste risk computed and saved.");
    } catch (err) {
        context.log("Error:", err);
    }
};
