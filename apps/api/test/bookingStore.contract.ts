import { describe, expect, it } from "vitest";
import type { BookingStore } from "../src/bookings/store.js";
import { storedBooking } from "./support/bookingFixtures.js";

/** Behaviour every BookingStore must have, whatever backs it. */
export function bookingStoreContract(name: string, makeStore: () => Promise<BookingStore> | BookingStore) {
  describe(`BookingStore contract: ${name}`, () => {
    // Restaurant ids are unique per test so a shared real database needs no cleanup between tests.
    let n = 0;
    const fresh = async () => ({ store: await makeStore(), r: `R-${Date.now()}-${++n}-${Math.random().toString(36).slice(2, 7)}` });

    it("creates, then reads back by restaurant+id and by id alone", async () => {
      const { store, r } = await fresh();
      const b = storedBooking({ restaurantId: r });
      expect(await store.create(b)).toMatchObject({ kind: "created" });
      expect(await store.get(r, b.id)).toMatchObject({ id: b.id, status: "confirmed", slot: "10:00" });
      expect((await store.findById(b.id))?.restaurantId).toBe(r);
      expect(await store.get(r, "bk_missing00")).toBeNull();
      expect(await store.findById("bk_missing00")).toBeNull();
    });

    it("does not expose store bookkeeping fields beyond the stored shape", async () => {
      const { store, r } = await fresh();
      const b = storedBooking({ restaurantId: r });
      await store.create(b);
      const read = await store.get(r, b.id);
      expect(read).not.toHaveProperty("slotKey");
      expect(read).not.toHaveProperty("_etag");
    });

    it("treats a second create with the same id as an existing booking", async () => {
      const { store, r } = await fresh();
      const b = storedBooking({ restaurantId: r });
      await store.create(b);
      const again = await store.create({ ...b, slot: "11:00" });
      expect(again).toMatchObject({ kind: "existing", booking: { id: b.id, slot: "10:00" } });
    });

    it("refuses a second confirmed booking in the same slot and names the holder", async () => {
      const { store, r } = await fresh();
      const first = storedBooking({ restaurantId: r });
      await store.create(first);
      const second = await store.create(storedBooking({ restaurantId: r }));
      expect(second).toEqual({ kind: "slot_taken", bookingId: first.id });
    });

    it("allows the same date and slot for a different restaurant, or another slot", async () => {
      const { store, r } = await fresh();
      await store.create(storedBooking({ restaurantId: r }));
      expect((await store.create(storedBooking({ restaurantId: `${r}-other` }))).kind).toBe("created");
      expect((await store.create(storedBooking({ restaurantId: r, slot: "10:30" }))).kind).toBe("created");
      expect((await store.create(storedBooking({ restaurantId: r, date: "2026-02-04" }))).kind).toBe("created");
    });

    it("lets exactly one of many concurrent bookings for a slot win", async () => {
      const { store, r } = await fresh();
      const results = await Promise.all(
        Array.from({ length: 8 }, () => store.create(storedBooking({ restaurantId: r, slot: "12:00" }))),
      );
      expect(results.filter((o) => o.kind === "created")).toHaveLength(1);
      expect(results.filter((o) => o.kind === "slot_taken")).toHaveLength(7);
    });

    it("lists one restaurant's bookings ordered by date then slot, optionally for one date", async () => {
      const { store, r } = await fresh();
      await store.create(storedBooking({ restaurantId: r, date: "2026-02-04", slot: "09:00" }));
      await store.create(storedBooking({ restaurantId: r, date: "2026-02-03", slot: "15:00" }));
      await store.create(storedBooking({ restaurantId: r, date: "2026-02-03", slot: "08:00" }));
      await store.create(storedBooking({ restaurantId: `${r}-other` }));
      const all = await store.list(r);
      expect(all.map((b) => `${b.date} ${b.slot}`)).toEqual([
        "2026-02-03 08:00",
        "2026-02-03 15:00",
        "2026-02-04 09:00",
      ]);
      expect(await store.list(r, "2026-02-04")).toHaveLength(1);
      expect(await store.list(r, "2030-01-01")).toEqual([]);
    });

    it("cancels, frees the slot, keeps the record, and is idempotent", async () => {
      const { store, r } = await fresh();
      const b = storedBooking({ restaurantId: r });
      await store.create(b);
      const cancelled = await store.cancel(r, b.id, "2026-02-02T00:00:00.000Z");
      expect(cancelled).toMatchObject({ status: "cancelled", updatedAt: "2026-02-02T00:00:00.000Z" });
      const again = await store.cancel(r, b.id, "2026-02-09T00:00:00.000Z");
      expect(again).toMatchObject({ status: "cancelled", updatedAt: "2026-02-02T00:00:00.000Z" });
      expect((await store.findById(b.id))?.status).toBe("cancelled");
      const rebook = await store.create(storedBooking({ restaurantId: r }));
      expect(rebook.kind).toBe("created");
    });

    it("allows several cancelled bookings for one slot over time", async () => {
      const { store, r } = await fresh();
      for (let i = 0; i < 3; i++) {
        const b = storedBooking({ restaurantId: r });
        expect((await store.create(b)).kind).toBe("created");
        await store.cancel(r, b.id, "2026-02-02T00:00:00.000Z");
      }
      expect(await store.list(r)).toHaveLength(3);
    });

    it("returns null when cancelling an unknown booking or one of another restaurant", async () => {
      const { store, r } = await fresh();
      const b = storedBooking({ restaurantId: r });
      await store.create(b);
      expect(await store.cancel(r, "bk_missing00", "x")).toBeNull();
      expect(await store.cancel(`${r}-other`, b.id, "x")).toBeNull();
      expect((await store.get(r, b.id))?.status).toBe("confirmed");
    });
  });
}
