import { CosmosBookingStore } from "../src/bookings/cosmosStore.js";
import { MemoryBookingStore } from "../src/bookings/memoryStore.js";
import { migrate } from "../src/migrations/index.js";
import { bookingStoreContract } from "./bookingStore.contract.js";
import { FakeCosmosDatabase } from "./support/fakeCosmos.js";

bookingStoreContract("MemoryBookingStore", () => new MemoryBookingStore());

// The Cosmos store runs against a model of Cosmos with the real migrations applied to it, so
// the unique-key policy the store depends on comes from migration 0001, not from the test.
bookingStoreContract("CosmosBookingStore on a fake Cosmos", async () => {
  const database = new FakeCosmosDatabase();
  await migrate(database);
  return new CosmosBookingStore(database);
});
