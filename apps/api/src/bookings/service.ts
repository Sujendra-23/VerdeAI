import { createHash, randomUUID } from "node:crypto";
import type { Booking } from "@verdeai/shared-types";
import type { Repository } from "../data/repository.js";
import { BookingError, notFound } from "./errors.js";
import type { CreateBookingInput } from "./schema.js";
import { toPublic, type BookingStore, type StoredBooking } from "./store.js";

export interface BookingResult {
  booking: Booking;
  /** True when an earlier request with the same Idempotency-Key already created this booking. */
  replayed: boolean;
}

/** Deterministic per (restaurant, key): the key *is* the booking's identity. */
export function bookingIdForKey(restaurantId: string, key: string): string {
  const digest = createHash("sha256").update(`${restaurantId}\n${key}`).digest("hex");
  return `bk_${digest.slice(0, 32)}`;
}

function hashRequest(input: CreateBookingInput & { item: string }): string {
  const canonical = JSON.stringify([
    input.restaurantId,
    input.date,
    input.slot,
    input.item,
    input.quantity,
    input.contactName,
    input.notes ?? null,
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

export class BookingService {
  constructor(
    private readonly repository: Repository,
    private readonly store: BookingStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async create(input: CreateBookingInput, idempotencyKey?: string): Promise<BookingResult> {
    const id = idempotencyKey
      ? bookingIdForKey(input.restaurantId, idempotencyKey)
      : `bk_${randomUUID().replaceAll("-", "")}`;

    // A retry of an already-successful request must replay even if the forecast has since
    // changed, so look for it before applying domain rules.
    if (idempotencyKey) {
      const prior = await this.store.get(input.restaurantId, id);
      if (prior) return this.replay(prior, input, prior.item);
    }

    const restaurants = await this.repository.listRestaurants();
    if (!restaurants.some((r) => r.restaurantId === input.restaurantId)) {
      throw notFound("restaurant", input.restaurantId);
    }
    const forecasts = await this.repository.getForecasts(input.restaurantId, input.date);
    const wanted = input.item.toLowerCase();
    const forecast = forecasts.find((f) => f.item.toLowerCase() === wanted);
    if (!forecast) {
      throw new BookingError(
        422,
        "unknown_item",
        `'${input.item}' is not on the forecast for ${input.restaurantId} on ${input.date}`,
        { forecastItems: forecasts.map((f) => f.item) },
      );
    }
    if (input.quantity > forecast.predictedQuantity) {
      throw new BookingError(
        422,
        "quantity_exceeds_forecast",
        `quantity ${input.quantity} is more than the ${forecast.predictedQuantity} forecast for '${forecast.item}'`,
        { predictedQuantity: forecast.predictedQuantity },
      );
    }

    const normalized = { ...input, item: forecast.item };
    const now = this.clock().toISOString();
    const booking: StoredBooking = {
      id,
      restaurantId: input.restaurantId,
      date: input.date,
      slot: input.slot,
      item: forecast.item,
      quantity: input.quantity,
      contactName: input.contactName,
      ...(input.notes ? { notes: input.notes } : {}),
      status: "confirmed",
      createdAt: now,
      updatedAt: now,
      requestHash: hashRequest(normalized),
      ...(idempotencyKey ? { idempotencyKey } : {}),
    };

    const outcome = await this.store.create(booking);
    switch (outcome.kind) {
      case "created":
        return { booking: toPublic(outcome.booking), replayed: false };
      case "existing":
        return this.replay(outcome.booking, input, forecast.item);
      case "slot_taken": {
        const holder = await this.store.findById(outcome.bookingId);
        if (holder?.requestHash === booking.requestHash) {
          throw new BookingError(
            409,
            "duplicate_booking",
            "an identical booking already exists; send an Idempotency-Key to make retries safe",
            { bookingId: holder.id },
          );
        }
        throw new BookingError(
          409,
          "slot_taken",
          `${input.slot} on ${input.date} is already booked for ${input.restaurantId}`,
          { bookingId: outcome.bookingId },
        );
      }
    }
  }

  private replay(stored: StoredBooking, input: CreateBookingInput, item: string): BookingResult {
    if (stored.requestHash !== hashRequest({ ...input, item })) {
      throw new BookingError(
        422,
        "idempotency_key_reused",
        "this Idempotency-Key was already used with a different request body",
        { bookingId: stored.id },
      );
    }
    return { booking: toPublic(stored), replayed: true };
  }

  async get(id: string): Promise<Booking> {
    const found = await this.store.findById(id);
    if (!found) throw notFound("booking", id);
    return toPublic(found);
  }

  async list(restaurantId: string, date?: string): Promise<Booking[]> {
    return (await this.store.list(restaurantId, date)).map(toPublic);
  }

  /** Idempotent: cancelling an already-cancelled booking returns it unchanged. */
  async cancel(id: string): Promise<Booking> {
    const found = await this.store.findById(id);
    if (!found) throw notFound("booking", id);
    const updated = await this.store.cancel(found.restaurantId, id, this.clock().toISOString());
    if (!updated) throw notFound("booking", id);
    return toPublic(updated);
  }
}
