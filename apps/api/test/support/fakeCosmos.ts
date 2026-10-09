import type { CosmosContainerLike, CosmosDatabaseLike } from "../../src/bookings/cosmosStore.js";

/**
 * A small in-memory model of the parts of Cosmos DB this app relies on: per-partition id
 * uniqueness, unique-key policies, ETag-conditional replace, 404 reads that return no resource,
 * and `createIfNotExists` that never alters an existing container. It exists so the stores and
 * the migration runner can be exercised without Azure. It is only as faithful as that list.
 */
export class FakeCosmosError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

type Doc = Record<string, any>;

class FakeContainer implements CosmosContainerLike {
  readonly docs = new Map<string, Doc>(); // `${partition}\u0000${id}` -> doc
  private etag = 0;
  constructor(public definition: Doc) {}

  private get pkField(): string {
    return this.definition.partitionKey.paths[0].slice(1);
  }

  private partitionOf(doc: Doc): string {
    return String(doc[this.pkField]);
  }

  private checkUnique(candidate: Doc, ignoreId?: string): void {
    const keys: Array<{ paths: string[] }> = this.definition.uniqueKeyPolicy?.uniqueKeys ?? [];
    for (const { paths } of keys) {
      const tuple = (d: Doc) => JSON.stringify(paths.map((p) => d[p.slice(1)] ?? null));
      for (const other of this.docs.values()) {
        if (
          other.id !== ignoreId &&
          this.partitionOf(other) === this.partitionOf(candidate) &&
          tuple(other) === tuple(candidate)
        ) {
          throw new FakeCosmosError(409, "unique key constraint violated");
        }
      }
    }
  }

  items = {
    create: async (body: unknown) => {
      const doc = { ...(body as Doc) };
      const key = `${this.partitionOf(doc)}\u0000${doc.id}`;
      if (this.docs.has(key)) throw new FakeCosmosError(409, "id already exists");
      this.checkUnique(doc);
      this.docs.set(key, { ...doc, _etag: `"${++this.etag}"` });
      return { statusCode: 201 };
    },
    query: <T>(spec: { query: string; parameters?: Array<{ name: string; value: unknown }> }) => ({
      fetchAll: async () => ({ resources: this.run<T>(spec) }),
    }),
  };

  private run<T>(spec: { query: string; parameters?: Array<{ name: string; value: unknown }> }): T[] {
    const where = /WHERE (.+)$/i.exec(spec.query)?.[1];
    const predicates = (where ? where.split(/\s+AND\s+/i) : []).map((clause) => {
      const m = /^c\.(\w+)\s*(=|!=)\s*(@\w+|'[^']*')$/.exec(clause.trim());
      if (!m) throw new Error(`FakeCosmos cannot parse clause: ${clause}`);
      const [, field, op, rhs] = m as unknown as [string, string, string, string];
      const value = rhs.startsWith("@")
        ? spec.parameters?.find((p) => p.name === rhs)?.value
        : rhs.slice(1, -1);
      return (d: Doc) => (op === "=" ? d[field] === value : d[field] !== value);
    });
    return [...this.docs.values()]
      .filter((d) => predicates.every((p) => p(d)))
      .map((d) => structuredClone(d)) as T[];
  }

  item(id: string, partitionKey?: string) {
    const key = `${partitionKey ?? id}\u0000${id}`;
    return {
      read: async <T>() => {
        const found = this.docs.get(key);
        return found
          ? { resource: structuredClone(found) as T, statusCode: 200 }
          : { resource: undefined, statusCode: 404 }; // the SDK returns 404 rather than throwing
      },
      replace: async (
        body: unknown,
        options?: { accessCondition?: { type: string; condition: string } },
      ) => {
        const current = this.docs.get(key);
        if (!current) throw new FakeCosmosError(404, "not found");
        if (options?.accessCondition && options.accessCondition.condition !== current._etag) {
          throw new FakeCosmosError(412, "precondition failed");
        }
        const next = { ...(body as Doc) };
        this.checkUnique(next, id);
        this.docs.set(key, { ...next, _etag: `"${++this.etag}"` });
        return { statusCode: 200 };
      },
      delete: async () => {
        this.docs.delete(key);
        return { statusCode: 204 };
      },
    };
  }

  // Container-level operations used by migrations.
  async read() {
    return { resource: structuredClone(this.definition) };
  }

  async replace(definition: Doc) {
    this.definition = structuredClone(definition);
    return { resource: this.definition };
  }
}

export class FakeCosmosDatabase implements CosmosDatabaseLike {
  readonly store = new Map<string, FakeContainer>();
  readonly created: string[] = [];

  containers = {
    createIfNotExists: async (def: Record<string, unknown>) => {
      const id = def.id as string;
      if (!this.store.has(id)) {
        this.store.set(id, new FakeContainer(structuredClone(def)));
        this.created.push(id);
      }
      return { container: this.store.get(id)! as CosmosContainerLike };
    },
  };

  container(id: string): CosmosContainerLike {
    const found = this.store.get(id);
    if (!found) throw new FakeCosmosError(404, `container ${id} does not exist`);
    return found;
  }

  definition(id: string): Doc {
    return this.store.get(id)!.definition;
  }

  docsIn(id: string): Doc[] {
    return [...this.store.get(id)!.docs.values()];
  }
}
