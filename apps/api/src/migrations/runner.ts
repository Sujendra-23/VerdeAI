import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { CosmosContainerLike, CosmosDatabaseLike } from "../bookings/cosmosStore.js";

/**
 * Versioned migrations for the Cosmos store.
 *
 * Cosmos is schemaless, so "migrating" means the things that *are* versioned: containers,
 * partition keys, unique-key and indexing policies, and data backfills. Each migration runs
 * once, in order, and is recorded in a `_migrations` ledger container. Rules:
 *
 *  - migrations must be idempotent (a crash after `up` but before the ledger write re-runs it);
 *  - an applied migration whose file has changed since is refused (checksum drift);
 *  - a database containing migrations this build does not know is refused (older code must not
 *    run against a newer schema);
 *  - a lock document stops two replicas starting at once from racing.
 */

export const LEDGER_CONTAINER = "_migrations";
const LOCK_ID = "_lock";
const LOCK_TTL_MS = 60_000;

export interface MigrationContext {
  database: CosmosDatabaseLike;
  log: (message: string) => void;
}

export interface Migration {
  version: string; // zero-padded and sortable, e.g. "0001"
  name: string;
  checksum: string;
  up(context: MigrationContext): Promise<void>;
}

/** Hash of the migration's source file (line endings normalised) for drift detection. */
export function checksumOfFile(fileUrl: URL): string {
  const text = readFileSync(fileURLToPath(fileUrl), "utf8").replaceAll("\r\n", "\n");
  return createHash("sha256").update(text).digest("hex");
}

export class MigrationError extends Error {
  constructor(
    message: string,
    readonly version?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "MigrationError";
  }
}

interface LedgerEntry {
  id: string;
  name: string;
  checksum: string;
  appliedAt: string;
  durationMs: number;
}

interface LedgerContainer extends CosmosContainerLike {
  item(
    id: string,
    partitionKey?: string,
  ): ReturnType<CosmosContainerLike["item"]> & { delete(): Promise<unknown> };
}

export interface MigrationReport {
  applied: string[];
  alreadyApplied: string[];
  pending: string[];
}

export interface RunOptions {
  dryRun?: boolean;
  log?: (message: string) => void;
  now?: () => Date;
  /** How long to wait for another instance's lock before giving up. */
  lockWaitMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

function statusOf(error: unknown): number | undefined {
  const raw = (error as { code?: unknown; statusCode?: unknown } | null)?.code ??
    (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof raw === "number" ? raw : undefined;
}

export class MigrationRunner {
  constructor(
    private readonly database: CosmosDatabaseLike,
    private readonly migrations: Migration[],
  ) {
    const versions = migrations.map((m) => m.version);
    if (new Set(versions).size !== versions.length) {
      throw new MigrationError("duplicate migration versions");
    }
    if ([...versions].sort().join() !== versions.join()) {
      throw new MigrationError("migrations must be registered in version order");
    }
  }

  private async ledger(): Promise<LedgerContainer> {
    const { container } = await this.database.containers.createIfNotExists({
      id: LEDGER_CONTAINER,
      partitionKey: { paths: ["/id"] },
    });
    return container as LedgerContainer;
  }

  /** Reads the ledger and compares it with the code, without changing anything. */
  async status(): Promise<MigrationReport> {
    const ledger = await this.ledger();
    return this.compare(await this.readLedger(ledger));
  }

  private async readLedger(ledger: LedgerContainer): Promise<LedgerEntry[]> {
    const { resources } = await ledger.items
      .query<LedgerEntry>({ query: `SELECT * FROM c WHERE c.id != '${LOCK_ID}'` })
      .fetchAll();
    return resources.sort((a, b) => a.id.localeCompare(b.id));
  }

  private compare(entries: LedgerEntry[]): MigrationReport {
    const known = new Map(this.migrations.map((m) => [m.version, m]));
    for (const entry of entries) {
      const migration = known.get(entry.id);
      if (!migration) {
        throw new MigrationError(
          `database has migration ${entry.id} (${entry.name}) that this build does not know; ` +
            "refusing to run older code against a newer schema",
          entry.id,
        );
      }
      if (migration.checksum !== entry.checksum) {
        throw new MigrationError(
          `migration ${entry.id} (${migration.name}) was modified after it was applied; ` +
            "add a new migration instead of editing an applied one",
          entry.id,
        );
      }
    }
    const applied = new Set(entries.map((e) => e.id));
    const pending = this.migrations.filter((m) => !applied.has(m.version));
    const highestApplied = entries.at(-1)?.id;
    const outOfOrder = pending.find((m) => highestApplied !== undefined && m.version < highestApplied);
    if (outOfOrder) {
      throw new MigrationError(
        `migration ${outOfOrder.version} is older than the newest applied migration ${highestApplied}; ` +
          "new migrations must have higher version numbers",
        outOfOrder.version,
      );
    }
    return {
      applied: [],
      alreadyApplied: entries.map((e) => e.id),
      pending: pending.map((m) => m.version),
    };
  }

  async run(options: RunOptions = {}): Promise<MigrationReport> {
    const log = options.log ?? (() => undefined);
    const now = options.now ?? (() => new Date());
    const ledger = await this.ledger();

    if (options.dryRun) return this.compare(await this.readLedger(ledger));

    const owner = randomUUID();
    await this.acquireLock(ledger, owner, options, now);
    try {
      const report = this.compare(await this.readLedger(ledger));
      for (const version of report.pending) {
        const migration = this.migrations.find((m) => m.version === version)!;
        const started = Date.now();
        log(`applying ${migration.version} ${migration.name}`);
        try {
          await migration.up({ database: this.database, log });
        } catch (cause) {
          throw new MigrationError(
            `migration ${migration.version} (${migration.name}) failed: ${(cause as Error).message}`,
            migration.version,
            { cause },
          );
        }
        const entry: LedgerEntry = {
          id: migration.version,
          name: migration.name,
          checksum: migration.checksum,
          appliedAt: now().toISOString(),
          durationMs: Date.now() - started,
        };
        await ledger.items.create(entry);
        report.applied.push(version);
      }
      report.pending = [];
      return report;
    } finally {
      await this.releaseLock(ledger, owner);
    }
  }

  private async acquireLock(
    ledger: LedgerContainer,
    owner: string,
    options: RunOptions,
    now: () => Date,
  ): Promise<void> {
    const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    const deadline = Date.now() + (options.lockWaitMs ?? 30_000);
    for (;;) {
      const lock = { id: LOCK_ID, owner, expiresAt: new Date(now().getTime() + LOCK_TTL_MS).toISOString() };
      try {
        await ledger.items.create(lock);
        return;
      } catch (error) {
        if (statusOf(error) !== 409) throw error;
      }
      // Held by someone: steal it only if it has expired (its owner crashed).
      const { resource } = await ledger.item(LOCK_ID, LOCK_ID).read<typeof lock & { _etag?: string }>();
      if (resource && new Date(resource.expiresAt) < now()) {
        try {
          await ledger
            .item(LOCK_ID, LOCK_ID)
            .replace(lock, { accessCondition: { type: "IfMatch", condition: resource._etag ?? "" } });
          return;
        } catch (error) {
          if (statusOf(error) !== 412) throw error; // someone else stole it first
        }
      }
      if (Date.now() >= deadline) {
        throw new MigrationError("another instance is running migrations; gave up waiting for its lock");
      }
      await sleep(250);
    }
  }

  private async releaseLock(ledger: LedgerContainer, owner: string): Promise<void> {
    try {
      const { resource } = await ledger.item(LOCK_ID, LOCK_ID).read<{ owner: string }>();
      if (resource?.owner === owner) await ledger.item(LOCK_ID, LOCK_ID).delete();
    } catch {
      // The lock expires on its own; a failed release must not mask the migration result.
    }
  }
}
