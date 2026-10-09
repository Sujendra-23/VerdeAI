import { describe, expect, it, vi } from "vitest";
import { loadMigrations, migrate, migrationStatus } from "../src/migrations/index.js";
import {
  LEDGER_CONTAINER,
  MigrationError,
  MigrationRunner,
  type Migration,
} from "../src/migrations/runner.js";
import { FakeCosmosDatabase } from "./support/fakeCosmos.js";

const noop = async (): Promise<void> => {};
const m = (version: string, up = noop, checksum = `sum-${version}`): Migration => ({
  version,
  name: `migration_${version}`,
  checksum,
  up,
});
const ledgerIds = (db: FakeCosmosDatabase) =>
  db.docsIn(LEDGER_CONTAINER).map((d) => d.id).filter((id) => id !== "_lock").sort();

describe("the shipped migrations", () => {
  it("build the bookings container with the unique slot key and trimmed indexing", async () => {
    const db = new FakeCosmosDatabase();
    const report = await migrate(db);
    expect(report.applied).toEqual(["0001", "0002"]);
    const def = db.definition("bookings");
    expect(def.partitionKey.paths).toEqual(["/restaurantId"]);
    expect(def.uniqueKeyPolicy.uniqueKeys).toEqual([{ paths: ["/slotKey"] }]);
    expect(def.indexingPolicy.excludedPaths).toEqual([{ path: "/notes/?" }, { path: "/contactName/?" }]);
    expect(ledgerIds(db)).toEqual(["0001", "0002"]);
    const entry = db.docsIn(LEDGER_CONTAINER).find((d) => d.id === "0001")!;
    expect(entry).toMatchObject({ name: "create_bookings_container" });
    expect(entry.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it("are a no-op the second time and report what is applied", async () => {
    const db = new FakeCosmosDatabase();
    await migrate(db);
    expect((await migrate(db)).applied).toEqual([]);
    expect(await migrationStatus(db)).toEqual({ applied: [], alreadyApplied: ["0001", "0002"], pending: [] });
  });

  it("have stable, distinct checksums that are derived from the files", () => {
    const [a, b] = loadMigrations();
    expect(a!.checksum).not.toBe(b!.checksum);
    expect(loadMigrations()[0]!.checksum).toBe(a!.checksum);
  });

  it("stop with a clear error if an old bookings container lacks the unique key", async () => {
    const db = new FakeCosmosDatabase();
    await db.containers.createIfNotExists({ id: "bookings", partitionKey: { paths: ["/restaurantId"] } });
    await expect(migrate(db)).rejects.toThrow(/without the \/slotKey unique key/);
    expect(ledgerIds(db)).toEqual([]); // not recorded as applied
  });

  it("only add what is missing when the indexing policy was partly applied", async () => {
    const db = new FakeCosmosDatabase();
    await db.containers.createIfNotExists({
      id: "bookings",
      partitionKey: { paths: ["/restaurantId"] },
      uniqueKeyPolicy: { uniqueKeys: [{ paths: ["/slotKey"] }] },
      indexingPolicy: { indexingMode: "consistent", includedPaths: [{ path: "/*" }], excludedPaths: [{ path: "/notes/?" }] },
    });
    await migrate(db);
    expect(db.definition("bookings").indexingPolicy.excludedPaths).toEqual([
      { path: "/notes/?" },
      { path: "/contactName/?" },
    ]);
  });
});

describe("MigrationRunner", () => {
  it("applies pending migrations in order and records each", async () => {
    const db = new FakeCosmosDatabase();
    const order: string[] = [];
    const runner = new MigrationRunner(db, [m("0001", async () => void order.push("1")), m("0002", async () => void order.push("2"))]);
    const report = await runner.run();
    expect(order).toEqual(["1", "2"]);
    expect(report).toMatchObject({ applied: ["0001", "0002"], pending: [] });
    expect(ledgerIds(db)).toEqual(["0001", "0002"]);
  });

  it("applies only the new migration when more are added later", async () => {
    const db = new FakeCosmosDatabase();
    const first = vi.fn(noop);
    await new MigrationRunner(db, [m("0001", first)]).run();
    const second = vi.fn(noop);
    const report = await new MigrationRunner(db, [m("0001", first), m("0002", second)]).run();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(report.applied).toEqual(["0002"]);
  });

  it("dry-run reports pending work and changes nothing", async () => {
    const db = new FakeCosmosDatabase();
    const up = vi.fn(noop);
    const report = await new MigrationRunner(db, [m("0001", up)]).run({ dryRun: true });
    expect(report.pending).toEqual(["0001"]);
    expect(up).not.toHaveBeenCalled();
    expect(ledgerIds(db)).toEqual([]);
  });

  it("refuses to run when an applied migration's file has changed", async () => {
    const db = new FakeCosmosDatabase();
    await new MigrationRunner(db, [m("0001", noop, "original")]).run();
    const edited = new MigrationRunner(db, [m("0001", noop, "edited"), m("0002")]);
    await expect(edited.run()).rejects.toThrow(/modified after it was applied/);
    expect(ledgerIds(db)).toEqual(["0001"]); // 0002 was not applied behind the error
  });

  it("refuses to run older code against a newer schema", async () => {
    const db = new FakeCosmosDatabase();
    await new MigrationRunner(db, [m("0001"), m("0002")]).run();
    await expect(new MigrationRunner(db, [m("0001")]).run()).rejects.toThrow(/does not know/);
  });

  it("refuses a new migration numbered below one already applied", async () => {
    const db = new FakeCosmosDatabase();
    await new MigrationRunner(db, [m("0001"), m("0003")]).run();
    await expect(new MigrationRunner(db, [m("0001"), m("0002"), m("0003")]).run()).rejects.toThrow(/older than the newest applied/);
  });

  it("validates its own registry", () => {
    const db = new FakeCosmosDatabase();
    expect(() => new MigrationRunner(db, [m("0001"), m("0001")])).toThrow(/duplicate/);
    expect(() => new MigrationRunner(db, [m("0002"), m("0001")])).toThrow(/version order/);
  });

  it("does not record a failed migration, releases the lock, and succeeds on re-run", async () => {
    const db = new FakeCosmosDatabase();
    let healthy = false;
    const flaky = m("0002", async () => {
      if (!healthy) throw new Error("boom");
    });
    const runner = new MigrationRunner(db, [m("0001"), flaky]);
    const error = (await runner.run().then(() => null, (e: unknown) => e)) as MigrationError;
    expect(error).toBeInstanceOf(MigrationError);
    expect(error.version).toBe("0002");
    expect(error.message).toMatch(/boom/);
    expect(ledgerIds(db)).toEqual(["0001"]);
    expect(db.docsIn(LEDGER_CONTAINER).some((d) => d.id === "_lock")).toBe(false);
    healthy = true;
    expect((await runner.run()).applied).toEqual(["0002"]);
  });

  it("serialises two instances starting together: each migration runs once", async () => {
    const db = new FakeCosmosDatabase();
    const up = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    const a = new MigrationRunner(db, [m("0001", up)]);
    const b = new MigrationRunner(db, [m("0001", up)]);
    const [ra, rb] = await Promise.all([a.run({ sleep: (ms) => new Promise((r) => setTimeout(r, ms / 25)) }), b.run({ sleep: (ms) => new Promise((r) => setTimeout(r, ms / 25)) })]);
    expect(up).toHaveBeenCalledTimes(1);
    expect([...ra.applied, ...rb.applied]).toEqual(["0001"]);
  });

  it("gives up cleanly if another instance holds a live lock", async () => {
    const db = new FakeCosmosDatabase();
    const { container } = await db.containers.createIfNotExists({ id: LEDGER_CONTAINER, partitionKey: { paths: ["/id"] } });
    await container.items.create({ id: "_lock", owner: "someone", expiresAt: new Date(Date.now() + 60_000).toISOString() });
    const up = vi.fn(noop);
    await expect(
      new MigrationRunner(db, [m("0001", up)]).run({ lockWaitMs: 30, sleep: (ms) => new Promise((r) => setTimeout(r, ms / 25)) }),
    ).rejects.toThrow(/another instance/);
    expect(up).not.toHaveBeenCalled();
    expect(db.docsIn(LEDGER_CONTAINER).find((d) => d.id === "_lock")!.owner).toBe("someone");
  });

  it("takes over a lock whose owner crashed", async () => {
    const db = new FakeCosmosDatabase();
    const { container } = await db.containers.createIfNotExists({ id: LEDGER_CONTAINER, partitionKey: { paths: ["/id"] } });
    await container.items.create({ id: "_lock", owner: "dead", expiresAt: new Date(Date.now() - 1000).toISOString() });
    const report = await new MigrationRunner(db, [m("0001")]).run();
    expect(report.applied).toEqual(["0001"]);
    expect(db.docsIn(LEDGER_CONTAINER).some((d) => d.id === "_lock")).toBe(false);
  });
});
