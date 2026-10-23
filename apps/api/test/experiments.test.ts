import {
  EXPERIMENTS,
  assignVariant,
  experimentBucket,
  summarizeExperiment,
  type ExperimentEvent,
} from "@verdeai/shared-types";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createRepository } from "../src/data/repository.js";
import { createServer } from "../src/server.js";

const ID = "forecast-inline-risk" as const;
const CONVERSION = EXPERIMENTS[ID].conversionEvent;

function userIn(variant: string, skip = 0): string {
  let seen = 0;
  for (let i = 0; i < 10_000; i++) {
    const userId = `user-${i}`;
    if (assignVariant(ID, userId) === variant && seen++ === skip) return userId;
  }
  throw new Error(`no user found for ${variant}`);
}

const exposure = (userId: string, variant = assignVariant(ID, userId)): ExperimentEvent => ({
  experimentId: ID, userId, variant, type: "exposure",
});
const conversion = (userId: string): ExperimentEvent => ({
  experimentId: ID, userId, variant: assignVariant(ID, userId), type: "conversion", event: CONVERSION,
});

const newApp = () => createServer(createRepository({} as NodeJS.ProcessEnv));

describe("variant assignment", () => {
  it("is stable for the same user and experiment", () => {
    for (let i = 0; i < 200; i++) {
      expect(assignVariant(ID, `user-${i}`)).toBe(assignVariant(ID, `user-${i}`));
    }
  });

  it("locks the hash with fixed vectors so future edits cannot reshuffle cohorts", () => {
    // Buckets were computed with an independent FNV-1a implementation.
    expect(experimentBucket(ID, "user-0")).toBe(24);
    expect(experimentBucket(ID, "user-1")).toBe(43);
    expect(experimentBucket(ID, "tenant-0")).toBe(99);
    expect(assignVariant(ID, "user-0")).toBe("control");
    expect(assignVariant(ID, "tenant-0")).toBe("treatment");
  });

  it("splits 10,000 users close to the 50/50 weights", () => {
    let treatment = 0;
    for (let i = 0; i < 10_000; i++) if (assignVariant(ID, `user-${i}`) === "treatment") treatment++;
    expect(treatment).toBeGreaterThan(4_700);
    expect(treatment).toBeLessThan(5_300);
  });
});

describe("summarizeExperiment", () => {
  it("withholds a verdict until each variant has enough exposures", () => {
    const r = summarizeExperiment(EXPERIMENTS[ID], {
      control: { exposures: 10, conversions: 1 },
      treatment: { exposures: 10, conversions: 9 },
    });
    expect(r.verdict).toBe("not-enough-data");
  });

  it("flags a clear difference as significant and reports the lift", () => {
    const r = summarizeExperiment(EXPERIMENTS[ID], {
      control: { exposures: 200, conversions: 20 },
      treatment: { exposures: 200, conversions: 50 },
    });
    expect(r.lift).toBeCloseTo(1.5);
    expect(r.zScore).toBeGreaterThan(1.96);
    expect(r.verdict).toBe("significant");
  });

  it("calls a small gap with plenty of data not significant", () => {
    const r = summarizeExperiment(EXPERIMENTS[ID], {
      control: { exposures: 100, conversions: 20 },
      treatment: { exposures: 100, conversions: 22 },
    });
    expect(r.verdict).toBe("no-significant-difference");
  });

  it("handles empty arms without dividing by zero", () => {
    const r = summarizeExperiment(EXPERIMENTS[ID], {});
    expect(r.lift).toBeNull();
    expect(r.zScore).toBeNull();
    expect(r.variants.map((v) => v.rate)).toEqual([0, 0]);
  });
});

describe("POST /api/experiments/events", () => {
  it("records an exposure, then accepts but does not recount a repeat", async () => {
    const app = newApp();
    const user = userIn("treatment");
    expect((await request(app).post("/api/experiments/events").send(exposure(user))).status).toBe(201);
    const again = await request(app).post("/api/experiments/events").send(exposure(user));
    expect(again.status).toBe(202);
    expect(again.body).toEqual({ status: "duplicate" });
    const results = await request(app).get(`/api/experiments/${ID}/results`);
    expect(results.body.variants.find((v: { variant: string }) => v.variant === "treatment").exposures).toBe(1);
  });

  it("rejects a variant that is not the user's assignment", async () => {
    const user = userIn("control");
    const res = await request(newApp()).post("/api/experiments/events").send(exposure(user, "treatment"));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assignment/);
  });

  it("rejects unknown experiments, bad user ids, and unknown conversion events", async () => {
    const app = newApp();
    const user = userIn("control");
    expect((await request(app).post("/api/experiments/events").send({ ...exposure(user), experimentId: "nope" })).status).toBe(400);
    expect((await request(app).post("/api/experiments/events").send({ ...exposure(user), userId: "" })).status).toBe(400);
    expect((await request(app).post("/api/experiments/events").send({ ...exposure(user), userId: "x".repeat(65) })).status).toBe(400);
    await request(app).post("/api/experiments/events").send(exposure(user));
    expect((await request(app).post("/api/experiments/events").send({ ...conversion(user), event: "purchase" })).status).toBe(400);
    expect((await request(app).post("/api/experiments/events").send({})).status).toBe(400);
  });

  it("ignores a conversion from a user who was never exposed", async () => {
    const app = newApp();
    const res = await request(app).post("/api/experiments/events").send(conversion(userIn("treatment")));
    expect(res.status).toBe(202);
    expect(res.body.status).toBe("ignored");
    const results = await request(app).get(`/api/experiments/${ID}/results`);
    expect(results.body.variants.every((v: { conversions: number }) => v.conversions === 0)).toBe(true);
  });
});

describe("GET /api/experiments/:id/results", () => {
  it("counts distinct exposed and converted users per variant", async () => {
    const app = newApp();
    const post = (e: ExperimentEvent) => request(app).post("/api/experiments/events").send(e);
    const [c1, c2] = [userIn("control", 0), userIn("control", 1)];
    const [t1, t2, t3] = [userIn("treatment", 0), userIn("treatment", 1), userIn("treatment", 2)];
    for (const u of [c1, c2, t1, t2, t3]) await post(exposure(u));
    await post(conversion(c1));
    await post(conversion(t1));
    await post(conversion(t1)); // repeat click, not counted again
    await post(conversion(t2));

    const res = await request(app).get(`/api/experiments/${ID}/results`);
    expect(res.status).toBe(200);
    expect(res.body.conversionEvent).toBe(CONVERSION);
    expect(res.body.variants).toEqual([
      { variant: "control", exposures: 2, conversions: 1, rate: 0.5 },
      { variant: "treatment", exposures: 3, conversions: 2, rate: 2 / 3 },
    ]);
    expect(res.body.verdict).toBe("not-enough-data");
  });

  it("404s for an unknown experiment", async () => {
    expect((await request(newApp()).get("/api/experiments/nope/results")).status).toBe(404);
  });
});
