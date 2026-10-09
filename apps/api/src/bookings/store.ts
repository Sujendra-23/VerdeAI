import type { Booking } from "@verdeai/shared-types";

/** What a store persists: the public booking plus bookkeeping the API does not expose. */
export interface StoredBooking extends Booking {
  /** Hash of the create request; lets a retry with the same key be told from a different request. */
  requestHash: string;
  idempotencyKey?: string;
}

export type CreateOutcome =
  | { kind: "created"; booking: StoredBooking }
  /** Same id already stored: the same idempotent request being retried. */
  | { kind: "existing"; booking: StoredBooking }
  /** Another confirmed booking holds that restaurant/date/slot. */
  | { kind: "slot_taken"; bookingId: string };

/**
 * Persistence for bookings. Implementations must make `create` atomic: a booking id is stored
 * once, and at most one *confirmed* booking holds a (restaurantId, date, slot).
 */
export interface BookingStore {
  readonly mode: "memory" | "cosmos";
  create(booking: StoredBooking): Promise<CreateOutcome>;
  get(restaurantId: string, id: string): Promise<StoredBooking | null>;
  /** Id lookup without knowing the restaurant (the API exposes /bookings/:id). */
  findById(id: string): Promise<StoredBooking | null>;
  list(restaurantId: string, date?: string): Promise<StoredBooking[]>;
  /** Moves confirmed -> cancelled and frees the slot. Idempotent; null if the id is unknown. */
  cancel(restaurantId: string, id: string, now: string): Promise<StoredBooking | null>;
}

export const slotKey = (date: string, slot: string): string => `${date}|${slot}`;

export function toPublic(booking: StoredBooking): Booking {
  const { requestHash: _hash, idempotencyKey: _key, ...pub } = booking;
  return pub;
}
