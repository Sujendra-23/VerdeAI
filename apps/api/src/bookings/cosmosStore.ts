import { CosmosClient } from "@azure/cosmos";
import { slotKey, type BookingStore, type CreateOutcome, type StoredBooking } from "./store.js";

/** The slice of the Cosmos SDK this app uses, so tests can substitute a model of it. */
export interface CosmosContainerLike {
  items: {
    create(body: unknown): Promise<unknown>;
    query<T>(spec: { query: string; parameters?: Array<{ name: string; value: unknown }> }): {
      fetchAll(): Promise<{ resources: T[] }>;
    };
  };
  item(
    id: string,
    partitionKey?: string,
  ): {
    read<T>(): Promise<{ resource?: T; statusCode?: number }>;
    replace(
      body: unknown,
      options?: { accessCondition?: { type: string; condition: string } },
    ): Promise<unknown>;
  };
}

export interface CosmosDatabaseLike {
  container(id: string): CosmosContainerLike;
  containers: {
    createIfNotExists(def: Record<string, unknown>): Promise<{ container: CosmosContainerLike }>;
  };
}

export const BOOKINGS_CONTAINER = "bookings";

export function createCosmosDatabase(env: NodeJS.ProcessEnv = process.env): CosmosDatabaseLike {
  const endpoint = env.COSMOS_DB_ACCOUNT_URI;
  const key = env.COSMOS_DB_KEY;
  const database = env.COSMOS_DB_DATABASE;
  if (!endpoint || !key || !database) {
    throw new Error("COSMOS_DB_ACCOUNT_URI, COSMOS_DB_KEY and COSMOS_DB_DATABASE are required");
  }
  const client = new CosmosClient({ endpoint, key });
  return client.database(database) as unknown as CosmosDatabaseLike;
}

type Stored = StoredBooking & { slotKey: string; _etag?: string };

const SYSTEM_FIELDS = ["_rid", "_self", "_etag", "_attachments", "_ts", "slotKey"] as const;

function strip(doc: Stored): StoredBooking {
  const copy: Record<string, unknown> = { ...doc };
  for (const field of SYSTEM_FIELDS) delete copy[field];
  return copy as unknown as StoredBooking;
}

function code(error: unknown): number | undefined {
  const value = (error as { code?: unknown; statusCode?: unknown } | null) ?? {};
  const raw = value.code ?? value.statusCode;
  return typeof raw === "number" ? raw : undefined;
}

/**
 * Cosmos-backed store. Atomicity comes from the container itself, created by migration 0001:
 * partition key /restaurantId (so id uniqueness is per restaurant) and a unique key on /slotKey
 * (so only one confirmed booking can hold a slot). A cancelled booking's slotKey is made unique
 * to it, which frees the slot without deleting the audit record.
 */
export class CosmosBookingStore implements BookingStore {
  readonly mode = "cosmos" as const;

  constructor(private readonly database: CosmosDatabaseLike) {}

  private get container(): CosmosContainerLike {
    return this.database.container(BOOKINGS_CONTAINER);
  }

  private slotKeyFor(b: StoredBooking): string {
    return b.status === "confirmed" ? slotKey(b.date, b.slot) : `cancelled|${b.id}`;
  }

  async create(booking: StoredBooking): Promise<CreateOutcome> {
    const doc: Stored = { ...booking, slotKey: this.slotKeyFor(booking) };
    try {
      await this.container.items.create(doc);
      return { kind: "created", booking };
    } catch (error) {
      if (code(error) !== 409) throw error;
    }
    // 409 is either "this id exists" (an idempotent retry) or "this slot is held" (unique key).
    const existing = await this.get(booking.restaurantId, booking.id);
    if (existing) return { kind: "existing", booking: existing };
    const holder = await this.query<Stored>(
      "SELECT * FROM c WHERE c.restaurantId=@r AND c.slotKey=@k",
      [
        { name: "@r", value: booking.restaurantId },
        { name: "@k", value: doc.slotKey },
      ],
    );
    if (holder[0]) return { kind: "slot_taken", bookingId: holder[0].id };
    throw new Error("Cosmos reported a conflict but no conflicting booking could be found");
  }

  private async query<T>(query: string, parameters: Array<{ name: string; value: unknown }>) {
    const { resources } = await this.container.items.query<T>({ query, parameters }).fetchAll();
    return resources;
  }

  async get(restaurantId: string, id: string): Promise<StoredBooking | null> {
    try {
      const { resource, statusCode } = await this.container.item(id, restaurantId).read<Stored>();
      if (!resource || statusCode === 404) return null;
      return strip(resource);
    } catch (error) {
      if (code(error) === 404) return null;
      throw error;
    }
  }

  async findById(id: string): Promise<StoredBooking | null> {
    const rows = await this.query<Stored>("SELECT * FROM c WHERE c.id=@id", [
      { name: "@id", value: id },
    ]);
    return rows[0] ? strip(rows[0]) : null;
  }

  async list(restaurantId: string, date?: string): Promise<StoredBooking[]> {
    const rows = await this.query<Stored>(
      date
        ? "SELECT * FROM c WHERE c.restaurantId=@r AND c.date=@d"
        : "SELECT * FROM c WHERE c.restaurantId=@r",
      [{ name: "@r", value: restaurantId }, ...(date ? [{ name: "@d", value: date }] : [])],
    );
    // Sorted here: a multi-property ORDER BY would need a composite index.
    return rows
      .map(strip)
      .sort((a, b) => `${a.date}${a.slot}${a.id}`.localeCompare(`${b.date}${b.slot}${b.id}`));
  }

  async cancel(restaurantId: string, id: string, now: string): Promise<StoredBooking | null> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const { resource } = await this.container.item(id, restaurantId).read<Stored>();
      if (!resource) return null;
      if (resource.status === "cancelled") return strip(resource);
      const updated: Stored = {
        ...resource,
        status: "cancelled",
        updatedAt: now,
        slotKey: `cancelled|${id}`,
      };
      try {
        await this.container
          .item(id, restaurantId)
          .replace(updated, { accessCondition: { type: "IfMatch", condition: resource._etag ?? "" } });
        return strip(updated);
      } catch (error) {
        if (code(error) !== 412) throw error; // someone else changed it: re-read and retry
      }
    }
    throw new Error(`Could not cancel booking ${id}: too many concurrent updates`);
  }
}
