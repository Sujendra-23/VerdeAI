import "dotenv/config";
import { CosmosBookingStore, createCosmosDatabase } from "./bookings/cosmosStore.js";
import { MemoryBookingStore } from "./bookings/memoryStore.js";
import { createRepository } from "./data/repository.js";
import { migrate } from "./migrations/index.js";
import { createServer } from "./server.js";

const repository = createRepository();

// Cosmos mode: bring the schema up to date before serving, so a deploy and its migrations
// ship together. Set MIGRATE_ON_STARTUP=false to run `npm run migrate` as a separate step.
let bookings = new MemoryBookingStore() as MemoryBookingStore | CosmosBookingStore;
if (repository.mode === "cosmos") {
  const database = createCosmosDatabase();
  if (process.env.MIGRATE_ON_STARTUP !== "false") {
    const report = await migrate(database, {
      log: (message) => console.log(`[verdeai-api] migrate: ${message}`), // eslint-disable-line no-console
    });
    // eslint-disable-next-line no-console
    console.log(`[verdeai-api] migrations applied: ${report.applied.join(", ") || "none pending"}`);
  }
  bookings = new CosmosBookingStore(database);
}

const app = createServer(repository, { bookings });
const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[verdeai-api] listening on http://localhost:${port} (data source: ${repository.mode})`,
  );
  // eslint-disable-next-line no-console
  console.log(`[verdeai-api] REST:    http://localhost:${port}/api/*`);
  // eslint-disable-next-line no-console
  console.log(`[verdeai-api] GraphQL: http://localhost:${port}/graphql`);
});
