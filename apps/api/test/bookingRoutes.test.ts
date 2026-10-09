import request from "supertest";
import { describe, expect, it } from "vitest";
import { MemoryBookingStore } from "../src/bookings/memoryStore.js";
import { createRepository } from "../src/data/repository.js";
import { createServer } from "../src/server.js";
import { sampleForecast, validBody } from "./support/bookingFixtures.js";

const fresh = () =>
  createServer(createRepository({} as NodeJS.ProcessEnv), {
    bookings: new MemoryBookingStore(),
    clock: () => new Date("2026-02-01T12:00:00Z"),
  });

describe("POST /api/bookings", () => {
  it("creates a booking: 201, Location, public shape only", async () => {
    const res = await request(fresh()).post("/api/bookings").send(validBody());
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/bookings/${res.body.id}`);
    expect(res.body).toMatchObject({ status: "confirmed", slot: "14:30", quantity: 3 });
    expect(Object.keys(res.body).sort()).toEqual(
      ["contactName", "createdAt", "date", "id", "item", "quantity", "restaurantId", "slot", "status", "updatedAt"],
    );
  });

  it("is safe to retry with an Idempotency-Key: 200 + replay header + same booking", async () => {
    const app = fresh();
    const first = await request(app).post("/api/bookings").set("Idempotency-Key", "retry-key-0001").send(validBody());
    const retry = await request(app).post("/api/bookings").set("Idempotency-Key", "retry-key-0001").send(validBody());
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.headers["idempotent-replayed"]).toBe("true");
    expect(retry.body).toEqual(first.body);
    const list = await request(app).get(`/api/bookings?restaurantId=${sampleForecast.restaurantId}`);
    expect(list.body).toHaveLength(1);
  });

  it("422s a reused key with a different body", async () => {
    const app = fresh();
    await request(app).post("/api/bookings").set("Idempotency-Key", "retry-key-0002").send(validBody());
    const res = await request(app).post("/api/bookings").set("Idempotency-Key", "retry-key-0002").send(validBody({ quantity: 1 }));
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("idempotency_key_reused");
  });

  it.each(["short", "has spaces in it!!", "x".repeat(129)])("400s the malformed key %j", async (key) => {
    const res = await request(fresh()).post("/api/bookings").set("Idempotency-Key", key).send(validBody());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid_idempotency_key");
  });

  it("409s duplicates and conflicts with distinct codes", async () => {
    const app = fresh();
    await request(app).post("/api/bookings").send(validBody());
    const dup = await request(app).post("/api/bookings").send(validBody());
    expect([dup.status, dup.body.code]).toEqual([409, "duplicate_booking"]);
    const clash = await request(app).post("/api/bookings").send(validBody({ contactName: "Other" }));
    expect([clash.status, clash.body.code]).toEqual([409, "slot_taken"]);
    expect(clash.body.details.bookingId).toMatch(/^bk_/);
  });

  it("maps domain rules to 404 / 422", async () => {
    const app = fresh();
    expect((await request(app).post("/api/bookings").send(validBody({ restaurantId: "R999" }))).status).toBe(404);
    expect((await request(app).post("/api/bookings").send(validBody({ item: "Nope" }))).status).toBe(422);
    expect((await request(app).post("/api/bookings").send(validBody({ quantity: 9999 }))).status).toBe(422);
  });

  const badBodies: Array<[string, Record<string, unknown>, string]> = [
    ["missing restaurantId", (({ restaurantId, ...rest }) => rest)(validBody()), "restaurantId"],
    ["impossible date", validBody({ date: "2026-02-30" }), "date"],
    ["wrong date format", validBody({ date: "02/03/2026" }), "date"],
    ["off-grid slot", validBody({ slot: "14:15" }), "slot"],
    ["slot before opening", validBody({ slot: "05:30" }), "slot"],
    ["slot after closing", validBody({ slot: "22:30" }), "slot"],
    ["zero quantity", validBody({ quantity: 0 }), "quantity"],
    ["fractional quantity", validBody({ quantity: 1.5 }), "quantity"],
    ["string quantity", validBody({ quantity: "3" }), "quantity"],
    ["huge quantity", validBody({ quantity: 10_001 }), "quantity"],
    ["blank contact", validBody({ contactName: "   " }), "contactName"],
    ["long notes", validBody({ notes: "n".repeat(501) }), "notes"],
    ["unknown field", validBody({ status: "cancelled" }), "(body)"],
  ];
  it.each(badBodies)("400s %s and points at the field", async (_name, body, path) => {
    const res = await request(fresh()).post("/api/bookings").send(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("validation_error");
    expect(res.body.details.map((d: { path: string }) => d.path)).toContain(path);
  });

  it("400s an empty or non-object body", async () => {
    const app = fresh();
    expect((await request(app).post("/api/bookings").send({})).status).toBe(400);
    expect((await request(app).post("/api/bookings").send([1, 2])).status).toBe(400);
    expect((await request(app).post("/api/bookings")).status).toBe(400);
  });

  it("400s malformed JSON as JSON, not an HTML stack trace", async () => {
    const res = await request(fresh())
      .post("/api/bookings")
      .set("Content-Type", "application/json")
      .send('{"restaurantId": ');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid_json");
    expect(res.headers["content-type"]).toMatch(/json/);
  });

  it("413s an oversized body", async () => {
    const res = await request(fresh()).post("/api/bookings").send(validBody({ notes: "n".repeat(200_000) }));
    expect(res.status).toBe(413);
    expect(res.body.code).toBe("payload_too_large");
  });

  it("trims whitespace in text fields", async () => {
    const res = await request(fresh()).post("/api/bookings").send(validBody({ contactName: "  Dana  ", notes: " hi " }));
    expect(res.body).toMatchObject({ contactName: "Dana", notes: "hi" });
  });
});

describe("GET /api/bookings and /:id, POST /:id/cancel", () => {
  it("lists by restaurant (and date), requires restaurantId", async () => {
    const app = fresh();
    await request(app).post("/api/bookings").send(validBody({ slot: "10:00" }));
    await request(app).post("/api/bookings").send(validBody({ slot: "09:00" }));
    const list = await request(app).get(`/api/bookings?restaurantId=${sampleForecast.restaurantId}&date=${sampleForecast.date}`);
    expect(list.body.map((b: { slot: string }) => b.slot)).toEqual(["09:00", "10:00"]);
    expect((await request(app).get("/api/bookings")).status).toBe(400);
    expect((await request(app).get("/api/bookings?restaurantId=R001&date=nope")).status).toBe(400);
    expect((await request(app).get("/api/bookings?restaurantId=R001&extra=1")).status).toBe(400);
  });

  it("gets by id, 404s unknown, 400s malformed ids", async () => {
    const app = fresh();
    const created = await request(app).post("/api/bookings").send(validBody());
    expect((await request(app).get(`/api/bookings/${created.body.id}`)).body).toEqual(created.body);
    expect((await request(app).get("/api/bookings/bk_doesnotexist1")).status).toBe(404);
    expect((await request(app).get("/api/bookings/not-an-id")).status).toBe(400);
  });

  it("cancels idempotently and frees the slot", async () => {
    const app = fresh();
    const created = await request(app).post("/api/bookings").send(validBody());
    const a = await request(app).post(`/api/bookings/${created.body.id}/cancel`);
    const b = await request(app).post(`/api/bookings/${created.body.id}/cancel`);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body.status).toBe("cancelled");
    expect(b.body).toEqual(a.body);
    expect((await request(app).post("/api/bookings").send(validBody())).status).toBe(201);
    expect((await request(app).post("/api/bookings/bk_doesnotexist1/cancel")).status).toBe(404);
  });
});

describe("existing endpoints keep working beside the new ones", () => {
  it("still serves the read API and the mock health check", async () => {
    const app = fresh();
    expect((await request(app).get("/api/health")).body).toEqual({ status: "ok", dataSource: "mock" });
    const res = await request(app).get(`/api/forecasts?restaurantId=${sampleForecast.restaurantId}&date=${sampleForecast.date}`);
    expect(res.status).toBe(200);
  });

  it("refuses to start Cosmos mode without a durable booking store", () => {
    const cosmos = createRepository({ COSMOS_DB_ACCOUNT_URI: "https://x.documents.azure.com:443/", COSMOS_DB_KEY: "k" } as NodeJS.ProcessEnv);
    expect(() => createServer(cosmos)).toThrow(/BookingStore/);
  });
});
