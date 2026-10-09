/**
 * Migration runner CLI (Cosmos DB mode only):
 *
 *   npm run migrate -w @verdeai/api            # apply pending migrations
 *   npm run migrate -w @verdeai/api -- --status   # show applied/pending, change nothing
 *
 * The API also applies pending migrations on startup unless MIGRATE_ON_STARTUP=false.
 */
import "dotenv/config";
import { createCosmosDatabase } from "./bookings/cosmosStore.js";
import { migrate, migrationStatus } from "./migrations/index.js";

const database = createCosmosDatabase();
const log = (message: string) => console.log(`[migrate] ${message}`); // eslint-disable-line no-console

try {
  if (process.argv.includes("--status")) {
    const report = await migrationStatus(database);
    log(`applied: ${report.alreadyApplied.join(", ") || "(none)"}`);
    log(`pending: ${report.pending.join(", ") || "(none)"}`);
  } else {
    const report = await migrate(database, { log });
    log(`done; applied now: ${report.applied.join(", ") || "(nothing to do)"}`);
  }
} catch (error) {
  console.error(`[migrate] ${(error as Error).message}`); // eslint-disable-line no-console
  process.exitCode = 1;
}
