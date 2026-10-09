import { BOOKINGS_CONTAINER } from "../../bookings/cosmosStore.js";
import type { MigrationContext } from "../runner.js";

const EXCLUDED = ["/notes/?", "/contactName/?"];

/**
 * Stop indexing free-text and personal fields nobody queries on: lower write cost, and fewer
 * places for personal data to live. Indexing-policy changes are online and safe to re-apply.
 */
export async function up({ database, log }: MigrationContext): Promise<void> {
  const container = database.container(BOOKINGS_CONTAINER) as unknown as {
    read(): Promise<{ resource?: Record<string, any> }>;
    replace(definition: Record<string, unknown>): Promise<unknown>;
  };
  const { resource } = await container.read();
  if (!resource) throw new Error(`container '${BOOKINGS_CONTAINER}' does not exist`);
  const policy = resource.indexingPolicy ?? { indexingMode: "consistent", includedPaths: [{ path: "/*" }] };
  const excluded: Array<{ path: string }> = policy.excludedPaths ?? [];
  const missing = EXCLUDED.filter((path) => !excluded.some((e) => e.path === path));
  if (missing.length === 0) {
    log("indexing policy already up to date");
    return;
  }
  await container.replace({
    ...resource,
    indexingPolicy: { ...policy, excludedPaths: [...excluded, ...missing.map((path) => ({ path }))] },
  });
  log(`excluded ${missing.join(", ")} from indexing`);
}
