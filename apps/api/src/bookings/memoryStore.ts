import { slotKey, type BookingStore, type CreateOutcome, type StoredBooking } from "./store.js";

/** In-process store for the mock-data demo mode and fast tests. */
export class MemoryBookingStore implements BookingStore {
  readonly mode = "memory" as const;
  private readonly byId = new Map<string, StoredBooking>();
  private readonly slots = new Map<string, string>(); // restaurant|date|slot -> booking id

  private slotId(b: Pick<StoredBooking, "restaurantId" | "date" | "slot">): string {
    return `${b.restaurantId}|${slotKey(b.date, b.slot)}`;
  }

  async create(booking: StoredBooking): Promise<CreateOutcome> {
    const existing = this.byId.get(booking.id);
    if (existing) return { kind: "existing", booking: { ...existing } };
    const holder = this.slots.get(this.slotId(booking));
    if (holder && booking.status === "confirmed") return { kind: "slot_taken", bookingId: holder };
    this.byId.set(booking.id, { ...booking });
    if (booking.status === "confirmed") this.slots.set(this.slotId(booking), booking.id);
    return { kind: "created", booking: { ...booking } };
  }

  async get(restaurantId: string, id: string): Promise<StoredBooking | null> {
    const found = this.byId.get(id);
    return found && found.restaurantId === restaurantId ? { ...found } : null;
  }

  async findById(id: string): Promise<StoredBooking | null> {
    const found = this.byId.get(id);
    return found ? { ...found } : null;
  }

  async list(restaurantId: string, date?: string): Promise<StoredBooking[]> {
    return [...this.byId.values()]
      .filter((b) => b.restaurantId === restaurantId && (!date || b.date === date))
      .sort((a, b) => `${a.date}${a.slot}${a.id}`.localeCompare(`${b.date}${b.slot}${b.id}`))
      .map((b) => ({ ...b }));
  }

  async cancel(restaurantId: string, id: string, now: string): Promise<StoredBooking | null> {
    const found = this.byId.get(id);
    if (!found || found.restaurantId !== restaurantId) return null;
    if (found.status === "confirmed") {
      found.status = "cancelled";
      found.updatedAt = now;
      this.slots.delete(this.slotId(found));
    }
    return { ...found };
  }
}
