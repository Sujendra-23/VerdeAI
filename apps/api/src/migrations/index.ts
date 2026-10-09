import type { CosmosDatabaseLike } from "../bookings/cosmosStore.js";
import { checksumOfFile, MigrationRunner, type Migration, type MigrationReport } from "./runner.js";
import { up as up0001 } from "./versions/0001_create_bookings_container.js";
import { up as up0002 } from "./versions/0002_bookings_indexing_policy.js";

const fileOf = (name: string) => checksumOfFile(new URL(`./versions/${name}`, import.meta.url));

/** Append new migrations to the end with the next version number. Never edit an applied one. */
export function loadMigrations(): Migration[] {
  return [
    {
      version: "0001",
      name: "create_bookings_container",
      checksum: fileOf("0001_create_bookings_container.ts"),
      up: up0001,
    },
    {
      version: "0002",
      name: "bookings_indexing_policy",
      checksum: fileOf("0002_bookings_indexing_policy.ts"),
      up: up0002,
    },
  ];
}

export async function migrate(
  database: CosmosDatabaseLike,
  options: { dryRun?: boolean; log?: (message: string) => void } = {},
): Promise<MigrationReport> {
  return new MigrationRunner(database, loadMigrations()).run(options);
}

export async function migrationStatus(database: CosmosDatabaseLike): Promise<MigrationReport> {
  return new MigrationRunner(database, loadMigrations()).status();
}
