import request from "supertest";
import { describe, expect, it } from "vitest";
import { createRepository } from "../src/data/repository.js";
import { MOCK_FORECASTS } from "../src/data/mockData.js";
import { createServer } from "../src/server.js";

const app = createServer(createRepository({} as NodeJS.ProcessEnv));
const sample = MOCK_FORECASTS[0]!;

describe("GET /api/health", () => {
  it("reports the mock data source", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", dataSource: "mock" });
  });
});

describe("GET /api/forecasts", () => {
  it("400s when restaurantId or date is missing", async () => {
    const res = await request(app).get("/api/forecasts?restaurantId=R001");
    expect(res.status).toBe(400);
  });

  it("returns the forecast rows for a known restaurant/date", async () => {
    const res = await request(app).get(
      `/api/forecasts?restaurantId=${sample.restaurantId}&date=${sample.date}`,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe("GET /api/waste-risk", () => {
  it("returns risk rows shaped with HIGH/LOW scores", async () => {
    const res = await request(app).get(
      `/api/waste-risk?restaurantId=${sample.restaurantId}&date=${sample.date}`,
    );
    expect(res.status).toBe(200);
    for (const row of res.body) {
      expect(["HIGH", "LOW"]).toContain(row.riskScore);
    }
  });
});

describe("POST /api/explain", () => {
  it("400s when restaurantId or date is missing", async () => {
    const res = await request(app).post("/api/explain").send({});
    expect(res.status).toBe(400);
  });

  it("returns a template explanation in test env", async () => {
    const res = await request(app)
      .post("/api/explain")
      .send({ restaurantId: sample.restaurantId, date: sample.date });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("template");
    expect(typeof res.body.explanation).toBe("string");
  });
});

describe("POST /api/explain/chat", () => {
  it("carries a conversation and answers a follow-up about a named item", async () => {
    const res = await request(app)
      .post("/api/explain/chat")
      .send({
        restaurantId: sample.restaurantId,
        date: sample.date,
        messages: [{ role: "user", content: `Tell me about the ${sample.item}` }],
      });
    expect(res.status).toBe(200);
    expect(res.body.reply.content).toContain(sample.item);
  });
});

describe("POST /graphql", () => {
  it("resolves the combined insight query in one round trip", async () => {
    const query = `
      query Insight($restaurantId: String!, $date: String!) {
        insight(restaurantId: $restaurantId, date: $date) {
          restaurant { restaurantId name }
          forecasts { item predictedQuantity }
          wasteRisk { item riskScore }
          explanation
        }
      }
    `;
    const res = await request(app)
      .post("/graphql")
      .send({ query, variables: { restaurantId: sample.restaurantId, date: sample.date } });
    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.insight.restaurant.restaurantId).toBe(sample.restaurantId);
    expect(res.body.data.insight.forecasts.length).toBeGreaterThan(0);
    expect(typeof res.body.data.insight.explanation).toBe("string");
  });
});
