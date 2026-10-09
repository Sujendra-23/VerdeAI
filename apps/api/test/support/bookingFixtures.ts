import { MOCK_FORECASTS } from "../../src/data/mockData.js";
import type { StoredBooking } from "../../src/bookings/store.js";

export const sampleForecast = MOCK_FORECASTS[0]!;

let counter = 0;
export function storedBooking(overrides: Partial<StoredBooking> = {}): StoredBooking {
  counter += 1;
  return {
    id: `bk_test${String(counter).padStart(8, "0")}`,
    restaurantId: "R001",
    date: "2026-02-03",
    slot: "10:00",
    item: "Grilled Chicken Bowl",
    quantity: 5,
    contactName: "Dana",
    status: "confirmed",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    requestHash: `hash-${counter}`,
    ...overrides,
  };
}

export const validBody = (overrides: Record<string, unknown> = {}) => ({
  restaurantId: sampleForecast.restaurantId,
  date: sampleForecast.date,
  slot: "14:30",
  item: sampleForecast.item,
  quantity: 3,
  contactName: "Dana Lee",
  ...overrides,
});
