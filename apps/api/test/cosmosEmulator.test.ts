import { CosmosClient } from "@azure/cosmos";
import { describe, expect, it } from "vitest";
import { CosmosBookingStore, type CosmosDatabaseLike } from "../src/bookings/cosmosStore.js";
import { migrate, migrationStatus } from "../src/migrations/index.js";
import { bookingStoreContract } from "./bookingStore.contract.js";

/**
 * Runs the store contract and the real migrations against an actual Cosmos endpoint.
 * Skipped unless COSMOS_EMULATOR_ENDPOINT and COSMOS_EMULATOR_KEY are set, e.g. with the
 * vNext emulator:
 *
 *   docker run -d -p 8081:8081 -e PROTOCOL=http \
 *     mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-preview
 *   COSMOS_EMULATOR_ENDPOINT=http://localhost:8081 COSMOS_EMULATOR_KEY=<emulator key> npm test
 *
 * Each run uses a throwaway database, deleted afterwards.
 */
const endpoint = process.env.COSMOS_EMULATOR_ENDPOINT;
const key = process.env.COSMOS_EMULATOR_KEY;

if (!endpoint || !key) {
  describe.skip("Cosmos emulator (set COSMOS_EMULATOR_ENDPOINT and COSMOS_EMULATOR_KEY)", () => {
    it("is skipped", () => undefined);
  });
} else {
  const client = new CosmosClient({ endpoint, key });
  const databaseId = `verdeai-test-${Date.now()}`;
  let database: CosmosDatabaseLike;

  describe("Cosmos emulator", () => {
    it("applies the migrations to a real Cosmos endpoint and is idempotent", async () => {
      const { database: created } = await client.databases.createIfNotExists({ id: databaseId });
      database = created as unknown as CosmosDatabaseLike;
      expect((await migrate(database)).applied).toEqual(["0001", "0002"]);
      expect((await migrate(database)).applied).toEqual([]);
      expect((await migrationStatus(database)).pending).toEqual([]);
      const { resource } = await client.database(databaseId).container("bookings").read();
      expect(resource?.uniqueKeyPolicy?.uniqueKeys).toEqual([{ paths: ["/slotKey"] }]);
    }, 60_000);

    bookingStoreContract("CosmosBookingStore on a real Cosmos endpoint", () => new CosmosBookingStore(database));

    it("cleans up", async () => {
      await client.database(databaseId).delete();
      expect(true).toBe(true);
    }, 60_000);
  });
}
