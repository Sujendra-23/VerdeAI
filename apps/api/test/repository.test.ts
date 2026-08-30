import { describe, expect, it } from "vitest";
import { computeRiskLevel } from "@verdeai/shared-types";
import { createRepository } from "../src/data/repository.js";
import { MOCK_FORECASTS, MOCK_RESTAURANTS } from "../src/data/mockData.js";

describe("computeRiskLevel", () => {
  it("flags HIGH when predicted demand exceeds 120% of the historical average", () => {
    expect(computeRiskLevel(121, 100)).toBe("HIGH");
  });

  it("flags LOW at exactly 120% of the historical average", () => {
    expect(computeRiskLevel(120, 100)).toBe("LOW");
  });

  it("flags LOW when predicted demand is under the historical average", () => {
    expect(computeRiskLevel(80, 100)).toBe("LOW");
  });
});

describe("createRepository", () => {
  it("falls back to the mock repository when Cosmos env vars are absent", () => {
    const repo = createRepository({} as NodeJS.ProcessEnv);
    expect(repo.mode).toBe("mock");
  });

  it("selects the Cosmos repository once both endpoint and key are present", () => {
    const repo = createRepository({
      COSMOS_DB_ACCOUNT_URI: "https://example.documents.azure.com:443/",
      COSMOS_DB_KEY: "test-key",
    } as NodeJS.ProcessEnv);
    expect(repo.mode).toBe("cosmos");
  });

  it("stays on mock mode if only one of the two Cosmos env vars is set", () => {
    const repo = createRepository({
      COSMOS_DB_ACCOUNT_URI: "https://example.documents.azure.com:443/",
    } as NodeJS.ProcessEnv);
    expect(repo.mode).toBe("mock");
  });
});

describe("MockRepository", () => {
  const repo = createRepository({} as NodeJS.ProcessEnv);

  it("lists the seeded restaurant roster", async () => {
    const restaurants = await repo.listRestaurants();
    expect(restaurants).toEqual(MOCK_RESTAURANTS);
  });

  it("filters forecasts by restaurantId and date", async () => {
    const sample = MOCK_FORECASTS[0]!;
    const forecasts = await repo.getForecasts(sample.restaurantId, sample.date);
    expect(forecasts.length).toBeGreaterThan(0);
    expect(forecasts.every((f) => f.restaurantId === sample.restaurantId && f.date === sample.date)).toBe(true);
  });

  it("returns an empty array for a restaurant/date with no data", async () => {
    const forecasts = await repo.getForecasts("does-not-exist", "1999-01-01");
    expect(forecasts).toEqual([]);
  });

  it("derives waste risk rows that agree with computeRiskLevel on the matching forecast", async () => {
    const sample = MOCK_FORECASTS[0]!;
    const [forecasts, wasteRisk] = await Promise.all([
      repo.getForecasts(sample.restaurantId, sample.date),
      repo.getWasteRisk(sample.restaurantId, sample.date),
    ]);
    for (const risk of wasteRisk) {
      const forecast = forecasts.find((f) => f.item === risk.item);
      expect(forecast).toBeDefined();
      expect(risk.riskScore).toBe(
        computeRiskLevel(forecast!.predictedQuantity, forecast!.historicalAverage),
      );
    }
  });
});
