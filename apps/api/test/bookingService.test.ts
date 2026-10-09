import { describe, expect, it } from "vitest";
import { BookingError } from "../src/bookings/errors.js";
import { MemoryBookingStore } from "../src/bookings/memoryStore.js";
import { BookingService, bookingIdForKey } from "../src/bookings/service.js";
import { createRepository, type Repository } from "../src/data/repository.js";
import { sampleForecast, validBody } from "./support/bookingFixtures.js";
import type { CreateBookingInput } from "../src/bookings/schema.js";

const repository = createRepository({} as NodeJS.ProcessEnv);
const make = (repo: Repository = repository) => {
  const store = new MemoryBookingStore();
  return { store, service: new BookingService(repo, store, () => new Date("2026-02-01T12:00:00Z")) };
};
const input = (o: Record<string, unknown> = {}) => validBody(o) as CreateBookingInput;

async function failure(promise: Promise<unknown>): Promise<BookingError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(BookingError);
    return error as BookingError;
  }
  throw new Error("expected the call to fail");
}

describe("BookingService.create", () => {
  it("books a forecast item, normalising its name to the forecast's spelling", async () => {
    const { service } = make();
    const { booking, replayed } = await service.create(input({ item: sampleForecast.item.toUpperCase() }));
    expect(replayed).toBe(false);
    expect(booking).toMatchObject({
      restaurantId: sampleForecast.restaurantId,
      item: sampleForecast.item,
      status: "confirmed",
      createdAt: "2026-02-01T12:00:00.000Z",
    });
    expect(booking.id).toMatch(/^bk_[0-9a-f]{32}$/);
    expect(booking).not.toHaveProperty("requestHash");
  });

  it("404s an unknown restaurant", async () => {
    const e = await failure(make().service.create(input({ restaurantId: "R999" })));
    expect([e.status, e.code]).toEqual([404, "restaurant_not_found"]);
  });

  it("422s an item that is not on that day's forecast, listing what is", async () => {
    const e = await failure(make().service.create(input({ item: "Mystery Stew" })));
    expect([e.status, e.code]).toEqual([422, "unknown_item"]);
    expect((e.details as { forecastItems: string[] }).forecastItems).toContain(sampleForecast.item);
  });

  it("422s a date with no forecast at all", async () => {
    const e = await failure(make().service.create(input({ date: "2031-01-01" })));
    expect(e.code).toBe("unknown_item");
  });

  it("422s a quantity above what was forecast", async () => {
    const e = await failure(make().service.create(input({ quantity: sampleForecast.predictedQuantity + 1 })));
    expect([e.status, e.code]).toEqual([422, "quantity_exceeds_forecast"]);
    expect(e.details).toEqual({ predictedQuantity: sampleForecast.predictedQuantity });
    // Exactly the forecast is fine.
    const ok = await make().service.create(input({ quantity: sampleForecast.predictedQuantity }));
    expect(ok.booking.quantity).toBe(sampleForecast.predictedQuantity);
  });
});

describe("idempotency", () => {
  it("replays the same booking for a repeated key and creates nothing new", async () => {
    const { service, store } = make();
    const first = await service.create(input(), "key-aaaaaaaa");
    const second = await service.create(input(), "key-aaaaaaaa");
    expect(second.replayed).toBe(true);
    expect(second.booking).toEqual(first.booking);
    expect(first.booking.id).toBe(bookingIdForKey(sampleForecast.restaurantId, "key-aaaaaaaa"));
    expect(await store.list(sampleForecast.restaurantId)).toHaveLength(1);
  });

  it("422s the same key with a different body and leaves the original untouched", async () => {
    const { service, store } = make();
    await service.create(input(), "key-bbbbbbbb");
    const e = await failure(service.create(input({ quantity: 1 }), "key-bbbbbbbb"));
    expect([e.status, e.code]).toEqual([422, "idempotency_key_reused"]);
    expect((await store.list(sampleForecast.restaurantId))[0]!.quantity).toBe(3);
  });

  it("replays even after the forecast has changed or disappeared", async () => {
    const { service } = make();
    const first = await service.create(input(), "key-cccccccc");
    const gone: Repository = { ...repository, mode: "mock", getForecasts: async () => [], listRestaurants: async () => [] } as unknown as Repository;
    const replayService = new BookingService(gone, (service as any).store);
    expect((await replayService.create(input(), "key-cccccccc")).booking.id).toBe(first.booking.id);
  });

  it("scopes keys to a restaurant", async () => {
    expect(bookingIdForKey("R001", "key-dddddddd")).not.toBe(bookingIdForKey("R002", "key-dddddddd"));
  });

  it("collapses concurrent retries with one key into a single booking", async () => {
    const { service, store } = make();
    const results = await Promise.all(Array.from({ length: 6 }, () => service.create(input(), "key-eeeeeeee")));
    expect(new Set(results.map((r) => r.booking.id)).size).toBe(1);
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    expect(await store.list(sampleForecast.restaurantId)).toHaveLength(1);
  });

  it("does not let a failed attempt consume the key", async () => {
    const { service } = make();
    await failure(service.create(input({ quantity: 10_000 }), "key-ffffffff"));
    const ok = await service.create(input({ quantity: 2 }), "key-ffffffff");
    expect(ok.replayed).toBe(false);
  });
});

describe("conflicts without a key", () => {
  it("409s an identical request as a duplicate", async () => {
    const { service } = make();
    const first = await service.create(input());
    const e = await failure(service.create(input()));
    expect([e.status, e.code]).toEqual([409, "duplicate_booking"]);
    expect(e.details).toEqual({ bookingId: first.booking.id });
  });

  it("409s a different request for a taken slot as slot_taken", async () => {
    const { service } = make();
    const first = await service.create(input());
    const e = await failure(service.create(input({ quantity: 1, contactName: "Someone Else" })));
    expect([e.status, e.code]).toEqual([409, "slot_taken"]);
    expect(e.details).toEqual({ bookingId: first.booking.id });
  });
});

describe("cancel / get / list", () => {
  it("cancels, is idempotent, frees the slot, and still serves the record", async () => {
    const { service } = make();
    const { booking } = await service.create(input());
    expect((await service.cancel(booking.id)).status).toBe("cancelled");
    expect((await service.cancel(booking.id)).status).toBe("cancelled");
    expect((await service.get(booking.id)).status).toBe("cancelled");
    expect((await service.create(input())).replayed).toBe(false);
    expect(await service.list(sampleForecast.restaurantId, sampleForecast.date)).toHaveLength(2);
  });

  it("404s unknown ids", async () => {
    const { service } = make();
    expect((await failure(service.get("bk_nonexistent1"))).code).toBe("booking_not_found");
    expect((await failure(service.cancel("bk_nonexistent1"))).status).toBe(404);
  });
});
