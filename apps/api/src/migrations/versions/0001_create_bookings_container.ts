import { BOOKINGS_CONTAINER } from "../../bookings/cosmosStore.js";
import type { MigrationContext } from "../runner.js";

/**
 * The bookings container: partitioned by restaurant, with a unique key on /slotKey so Cosmos
 * itself guarantees at most one confirmed booking per restaurant/date/slot.
 *
 * Unique-key policies can only be set when a container is created, so if a container with this
 * name already exists without the policy we stop instead of pretending it is fine.
 */
export async function up({ database, log }: MigrationContext): Promise<void> {
  const { container } = await database.containers.createIfNotExists({
    id: BOOKINGS_CONTAINER,
    partitionKey: { paths: ["/restaurantId"] },
    uniqueKeyPolicy: { uniqueKeys: [{ paths: ["/slotKey"] }] },
  });
  const { resource } = await (container as unknown as {
    read(): Promise<{ resource?: { uniqueKeyPolicy?: { uniqueKeys?: Array<{ paths: string[] }> } } }>;
  }).read();
  const hasKey = resource?.uniqueKeyPolicy?.uniqueKeys?.some((k) => k.paths.includes("/slotKey"));
  if (!hasKey) {
    throw new Error(
      `container '${BOOKINGS_CONTAINER}' exists without the /slotKey unique key; ` +
        "unique keys cannot be added afterwards, so recreate the container and copy its data",
    );
  }
  log(`container '${BOOKINGS_CONTAINER}' is ready`);
}
