import { computeRiskLevel } from "@verdeai/shared-types";
import type {
  ForecastRecord,
  Restaurant,
  WasteRiskRecord,
} from "@verdeai/shared-types";

/**
 * Deterministic seed data used when no Cosmos DB credentials are configured
 * (COSMOS_DB_ACCOUNT_URI / COSMOS_DB_KEY). Lets the dashboard, REST API, and
 * GraphQL API run end-to-end on a laptop with no Azure resources provisioned.
 */

export const MOCK_RESTAURANTS: Restaurant[] = [
  { restaurantId: "R001", name: "Verde Kitchen — Downtown", location: "Seattle, WA" },
  { restaurantId: "R002", name: "Verde Kitchen — Riverside", location: "Portland, OR" },
  { restaurantId: "R003", name: "Verde Kitchen — Harbor", location: "San Francisco, CA" },
];

const MENU_ITEMS: Array<{ item: string; base: number }> = [
  { item: "Grilled Chicken Bowl", base: 48 },
  { item: "Roasted Veggie Wrap", base: 30 },
  { item: "Miso Salmon Plate", base: 22 },
  { item: "Harvest Grain Salad", base: 36 },
  { item: "Spiced Lentil Soup", base: 18 },
];

const MOCK_DATES = ["2026-02-03", "2026-02-04", "2026-02-05", "2026-02-06"];

function seededJitter(seed: string, spread: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  // Deterministic pseudo-random value in [-spread, spread], stable across runs/tests.
  return ((hash % (spread * 2 + 1)) - spread);
}

function buildForecasts(): ForecastRecord[] {
  const records: ForecastRecord[] = [];
  for (const restaurant of MOCK_RESTAURANTS) {
    for (const date of MOCK_DATES) {
      for (const { item, base } of MENU_ITEMS) {
        const seed = `${restaurant.restaurantId}-${date}-${item}`;
        const historicalAverage = base + seededJitter(seed, 4);
        // A subset of item/day combos deliberately run hot, so waste risk has real HIGH rows.
        const runsHot = seededJitter(seed + "-hot", 10) > 3;
        const predictedQuantity = runsHot
          ? Math.round(historicalAverage * 1.35)
          : Math.round(historicalAverage + seededJitter(seed + "-qty", 3));

        records.push({
          id: seed,
          restaurantId: restaurant.restaurantId,
          date,
          item,
          predictedQuantity: Math.max(predictedQuantity, 1),
          historicalAverage: Math.max(historicalAverage, 1),
        });
      }
    }
  }
  return records;
}

export const MOCK_FORECASTS: ForecastRecord[] = buildForecasts();

export const MOCK_WASTE_RISK: WasteRiskRecord[] = MOCK_FORECASTS.map((f) => ({
  id: f.id,
  restaurantId: f.restaurantId,
  date: f.date,
  item: f.item,
  predictedQuantity: f.predictedQuantity,
  riskScore: computeRiskLevel(f.predictedQuantity, f.historicalAverage),
}));
