import axios from "axios";
import type { ForecastRecord, LanguageCode, WasteRiskRecord } from "@verdeai/shared-types";
import { SUPPORTED_LANGUAGES } from "@verdeai/shared-types";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Repository } from "../src/data/repository.js";
import { ExplainService } from "../src/services/explainService.js";
import { createServer } from "../src/server.js";

const forecasts: ForecastRecord[] = [
  { id: "1", restaurantId: "R9", date: "2026-03-01", item: "Miso Salmon Plate", predictedQuantity: 60, historicalAverage: 40 },
  { id: "2", restaurantId: "R9", date: "2026-03-01", item: "Spiced Lentil Soup", predictedQuantity: 20, historicalAverage: 20 },
];
const wasteRisk: WasteRiskRecord[] = [
  { id: "1", restaurantId: "R9", date: "2026-03-01", item: "Miso Salmon Plate", predictedQuantity: 60, riskScore: "HIGH" },
  { id: "2", restaurantId: "R9", date: "2026-03-01", item: "Spiced Lentil Soup", predictedQuantity: 20, riskScore: "LOW" },
];

function repo(calm = false): Repository {
  return {
    mode: "mock",
    listRestaurants: async () => [],
    getForecasts: async (r, d) => forecasts.filter((f) => f.restaurantId === r && f.date === d),
    getWasteRisk: async (r, d) =>
      calm
        ? wasteRisk.map((w) => ({ ...w, riskScore: "LOW" as const }))
        : wasteRisk.filter((w) => w.restaurantId === r && w.date === d),
  };
}

const ask = (service: ExplainService, content: string, language?: "auto" | LanguageCode) =>
  service.chat("R9", "2026-03-01", [{ role: "user", content }], language);

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.AZURE_OPENAI_ENDPOINT;
  delete process.env.AZURE_OPENAI_DEPLOYMENT;
  delete process.env.AZURE_OPENAI_API_KEY;
});

describe("ExplainService multilingual (template mode)", () => {
  const service = new ExplainService(repo());

  // Each phrase is how a manager in that language might ask about the salmon.
  const QUESTIONS: Array<[LanguageCode, string, RegExp]> = [
    ["en", "What about the Miso Salmon Plate today?", /forecast is 60 units/],
    ["es", "¿Qué pasa con el Miso Salmon Plate hoy?", /el pronóstico es de 60 unidades.*riesgo de desperdicio es ALTO/s],
    ["fr", "Que dois-je faire pour le Miso Salmon Plate aujourd'hui ?", /la prévision est de 60 unités.*ÉLEVÉ/s],
    ["de", "Was soll ich heute mit dem Miso Salmon Plate machen?", /Die Prognose liegt bei 60 Einheiten.*HOCH/s],
    ["pt", "Como devo preparar o Miso Salmon Plate hoje?", /a previsão é de 60 unidades.*ALTO/s],
    ["it", "Come devo preparare il Miso Salmon Plate oggi?", /la previsione è di 60 unità.*ALTO/s],
    ["hi", "आज Miso Salmon Plate के बारे में क्या करें?", /पूर्वानुमान 60 यूनिट/],
    ["zh", "今天的 Miso Salmon Plate 怎么样？", /预测量为 60 份/],
    ["ja", "今日の Miso Salmon Plate はどうですか？", /予測は 60 個/],
  ];

  it.each(QUESTIONS)("auto-detects %s and answers in that language", async (code, question, pattern) => {
    const result = await ask(service, question);
    expect(result.language).toBe(code);
    expect(result.source).toBe("template");
    expect(result.reply.content).toMatch(pattern);
    // Item names stay as written in the data.
    expect(result.reply.content).toContain("Miso Salmon Plate");
  });

  it("has a catalog entry for every supported language", async () => {
    for (const { code } of SUPPORTED_LANGUAGES) {
      const result = await ask(service, "Miso Salmon Plate", code);
      expect(result.language).toBe(code);
      expect(result.reply.content.length).toBeGreaterThan(10);
    }
  });

  it("an explicit language overrides what the question was written in", async () => {
    const result = await ask(service, "What about the Miso Salmon Plate today?", "es");
    expect(result.language).toBe("es");
    expect(result.reply.content).toMatch(/pronóstico/);
  });

  it("answers an overall risk question in Spanish with the localized summary", async () => {
    const result = await ask(service, "¿Qué platos tienen más riesgo de desperdicio hoy?");
    expect(result.language).toBe("es");
    expect(result.reply.content).toMatch(/1 de 2 artículos tienden a la sobreproducción/);
    expect(result.reply.content).toContain("Miso Salmon Plate (pronóstico 60, ~50 % por encima del promedio)");
  });

  it("answers an overall risk question in Japanese", async () => {
    const result = await ask(service, "今日はどの品目の廃棄リスクが高いですか？");
    expect(result.language).toBe("ja");
    expect(result.reply.content).toContain("2品目中1品目が過剰生産に傾いています");
  });

  it("reports a calm day in the question's language", async () => {
    const calm = new ExplainService(repo(true));
    const result = await ask(calm, "Quels plats ont un risque aujourd'hui ?");
    expect(result.language).toBe("fr");
    expect(result.reply.content).toMatch(/La demande semble stable pour les 2 articles/);
  });

  it("says an unknown dish isn't tracked, in German", async () => {
    const result = await ask(service, "Wie viel soll ich von der Mondstein-Pizza vorbereiten?");
    expect(result.language).toBe("de");
    expect(result.reply.content).toMatch(/Ich finde .* nicht namentlich/);
    expect(result.reply.content).toContain("Spiced Lentil Soup");
  });

  it("returns the no-data message localized", async () => {
    const result = await service.chat("nope", "1999-01-01", [{ role: "user", content: "¿Qué pasa hoy con el riesgo?" }]);
    expect(result.reply.content).toMatch(/Todavía no hay datos de pronóstico/);
  });

  it("explain() takes a language and returns it", async () => {
    const result = await service.explain("R9", "2026-03-01", "pt");
    expect(result.language).toBe("pt");
    expect(result.explanation).toMatch(/1 de 2 itens tendem à superprodução/);
  });
});

describe("ExplainService multilingual (Azure OpenAI path)", () => {
  function configureAzure() {
    process.env.AZURE_OPENAI_ENDPOINT = "https://example.openai.azure.com/";
    process.env.AZURE_OPENAI_DEPLOYMENT = "verdeai-explainer";
    process.env.AZURE_OPENAI_API_KEY = "test-key";
  }

  it("tells the model which language to reply in and reports it", async () => {
    configureAzure();
    const post = vi.spyOn(axios, "post").mockResolvedValue({
      data: { choices: [{ message: { content: "Reduce la preparación." } }] },
    });
    const service = new ExplainService(repo());

    const result = await ask(service, "¿Qué pasa con el salmón hoy?");

    expect(result.source).toBe("azure-openai");
    expect(result.language).toBe("es");
    const body = post.mock.calls[0]![1] as { messages: Array<{ role: string; content: string }> };
    expect(body.messages[0]!.role).toBe("system");
    expect(body.messages[0]!.content).toContain('Reply in Spanish (language code "es")');
  });

  it("uses the explicit language for the opening explanation too", async () => {
    configureAzure();
    const post = vi.spyOn(axios, "post").mockResolvedValue({
      data: { choices: [{ message: { content: "..." } }] },
    });
    const service = new ExplainService(repo());

    await service.chat("R9", "2026-03-01", [], "ja");

    const body = post.mock.calls[0]![1] as { messages: Array<{ role: string; content: string }> };
    expect(body.messages[0]!.content).toContain('Reply in Japanese (language code "ja")');
    expect(body.messages[1]!.role).toBe("user");
  });

  it("falls back to the localized template if Azure fails", async () => {
    configureAzure();
    vi.spyOn(axios, "post").mockRejectedValue(new Error("boom"));
    const service = new ExplainService(repo());

    const result = await ask(service, "¿Qué platos tienen riesgo hoy?");

    expect(result.source).toBe("template");
    expect(result.language).toBe("es");
    expect(result.reply.content).toMatch(/sobreproducción/);
  });
});

describe("language over HTTP", () => {
  const app = createServer(repo());
  const body = { restaurantId: "R9", date: "2026-03-01", messages: [{ role: "user", content: "Miso Salmon Plate" }] };

  it("POST /api/explain/chat honours `language` and echoes the language used", async () => {
    const res = await request(app).post("/api/explain/chat").send({ ...body, language: "de" });
    expect(res.status).toBe(200);
    expect(res.body.language).toBe("de");
    expect(res.body.reply.content).toMatch(/Prognose/);
  });

  it("POST /api/explain/chat auto-detects when `language` is omitted", async () => {
    const res = await request(app)
      .post("/api/explain/chat")
      .send({ ...body, messages: [{ role: "user", content: "¿Cómo está el Miso Salmon Plate hoy?" }] });
    expect(res.body.language).toBe("es");
  });

  it("rejects an unsupported language with 400", async () => {
    const res = await request(app).post("/api/explain/chat").send({ ...body, language: "klingon" });
    expect(res.status).toBe(400);
    const res2 = await request(app).post("/api/explain").send({ restaurantId: "R9", date: "2026-03-01", language: "xx" });
    expect(res2.status).toBe(400);
  });

  it("POST /api/explain accepts a language", async () => {
    const res = await request(app).post("/api/explain").send({ restaurantId: "R9", date: "2026-03-01", language: "fr" });
    expect(res.status).toBe(200);
    expect(res.body.language).toBe("fr");
    expect(res.body.explanation).toMatch(/articles sur 2/);
  });

  it("GraphQL explainChat takes a language and returns the one used", async () => {
    const query = `mutation($m: [ChatMessageInput!]!, $l: String) {
      explainChat(restaurantId: "R9", date: "2026-03-01", messages: $m, language: $l) {
        reply { content } source language
      }
    }`;
    const res = await request(app)
      .post("/graphql")
      .send({ query, variables: { m: [{ role: "user", content: "Miso Salmon Plate" }], l: "it" } });
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.explainChat.language).toBe("it");
    expect(res.body.data.explainChat.reply.content).toMatch(/previsione/);

    const bad = await request(app)
      .post("/graphql")
      .send({ query, variables: { m: [{ role: "user", content: "x" }], l: "xx" } });
    expect(bad.body.errors?.[0]?.message).toMatch(/language must be/);
  });
});
