import { CosmosClient } from "@azure/cosmos";
import type {
  ForecastRecord,
  Restaurant,
  WasteRiskRecord,
} from "@verdeai/shared-types";
import { MOCK_FORECASTS, MOCK_RESTAURANTS, MOCK_WASTE_RISK } from "./mockData.js";

/**
 * Single data-access surface for the REST and GraphQL layers.
 *
 * Uses live Cosmos DB when COSMOS_DB_ACCOUNT_URI + COSMOS_DB_KEY are set
 * (the same env vars apps/functions reads), otherwise serves the seeded
 * mock dataset so the dashboard is runnable with zero Azure resources.
 */
export interface Repository {
  readonly mode: "cosmos" | "mock";
  listRestaurants(): Promise<Restaurant[]>;
  getForecasts(restaurantId: string, date: string): Promise<ForecastRecord[]>;
  getWasteRisk(restaurantId: string, date: string): Promise<WasteRiskRecord[]>;
}

class MockRepository implements Repository {
  readonly mode = "mock" as const;

  async listRestaurants(): Promise<Restaurant[]> {
    return MOCK_RESTAURANTS;
  }

  async getForecasts(restaurantId: string, date: string): Promise<ForecastRecord[]> {
    return MOCK_FORECASTS.filter(
      (f) => f.restaurantId === restaurantId && f.date === date,
    );
  }

  async getWasteRisk(restaurantId: string, date: string): Promise<WasteRiskRecord[]> {
    return MOCK_WASTE_RISK.filter(
      (w) => w.restaurantId === restaurantId && w.date === date,
    );
  }
}

class CosmosRepository implements Repository {
  readonly mode = "cosmos" as const;
  private readonly client: CosmosClient;

  constructor(endpoint: string, key: string) {
    this.client = new CosmosClient({ endpoint, key });
  }

  private database() {
    const dbName = process.env.COSMOS_DB_DATABASE;
    if (!dbName) {
      throw new Error("COSMOS_DB_DATABASE is required when COSMOS_DB_ACCOUNT_URI is set");
    }
    return this.client.database(dbName);
  }

  async listRestaurants(): Promise<Restaurant[]> {
    // The Functions app never wrote a restaurants container — forecasts/waste_logs
    // are keyed by restaurantId, so we derive the roster from distinct forecast rows.
    const container = this.database().container("forecasts");
    const { resources } = await container.items
      .query<{ restaurantId: string }>(
        "SELECT DISTINCT VALUE { restaurantId: c.restaurantId } FROM c",
      )
      .fetchAll();
    return resources.map((r) => ({
      restaurantId: r.restaurantId,
      name: r.restaurantId,
      location: "",
    }));
  }

  async getForecasts(restaurantId: string, date: string): Promise<ForecastRecord[]> {
    const container = this.database().container("forecasts");
    const { resources } = await container.items
      .query<ForecastRecord>({
        query: "SELECT * FROM c WHERE c.restaurantId=@r AND c.date=@d",
        parameters: [
          { name: "@r", value: restaurantId },
          { name: "@d", value: date },
        ],
      })
      .fetchAll();
    return resources;
  }

  async getWasteRisk(restaurantId: string, date: string): Promise<WasteRiskRecord[]> {
    const container = this.database().container("waste_logs");
    const { resources } = await container.items
      .query<WasteRiskRecord>({
        query: "SELECT * FROM c WHERE c.restaurantId=@r AND c.date=@d",
        parameters: [
          { name: "@r", value: restaurantId },
          { name: "@d", value: date },
        ],
      })
      .fetchAll();
    return resources;
  }
}

export function createRepository(env: NodeJS.ProcessEnv = process.env): Repository {
  const endpoint = env.COSMOS_DB_ACCOUNT_URI;
  const key = env.COSMOS_DB_KEY;
  if (endpoint && key) {
    return new CosmosRepository(endpoint, key);
  }
  return new MockRepository();
}
