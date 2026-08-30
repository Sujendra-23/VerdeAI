import { beforeEach, describe, expect, it } from "vitest";
import { createRepository } from "../src/data/repository.js";
import { MOCK_FORECASTS } from "../src/data/mockData.js";
import { ExplainService } from "../src/services/explainService.js";

// No AZURE_OPENAI_* env vars are set in the test environment, so ExplainService
// always exercises its templated fallback path here — deterministic, no network calls.
describe("ExplainService (template mode)", () => {
  let service: ExplainService;
  let sample: (typeof MOCK_FORECASTS)[number];

  beforeEach(() => {
    service = new ExplainService(createRepository({} as NodeJS.ProcessEnv));
    sample = MOCK_FORECASTS[0]!;
  });

  it("produces a template explanation grounded in the day's data", async () => {
    const result = await service.explain(sample.restaurantId, sample.date);
    expect(result.source).toBe("template");
    expect(result.explanation.length).toBeGreaterThan(0);
  });

  it("returns a no-data message for a restaurant/date with nothing forecasted", async () => {
    const result = await service.explain("does-not-exist", "1999-01-01");
    expect(result.source).toBe("template");
    expect(result.explanation).toMatch(/no forecast data/i);
  });

  it("answers a follow-up chat question about a specific item by name", async () => {
    const result = await service.chat(sample.restaurantId, sample.date, [
      { role: "user", content: `What about the ${sample.item}?` },
    ]);
    expect(result.source).toBe("template");
    expect(result.reply.role).toBe("assistant");
    expect(result.reply.content).toContain(sample.item);
  });

  it("says so when a chat question names an item not on the menu that day", async () => {
    const result = await service.chat(sample.restaurantId, sample.date, [
      { role: "user", content: "What about the Moon Rock Burrito?" },
    ]);
    expect(result.reply.content).toMatch(/don't see/i);
  });
});
