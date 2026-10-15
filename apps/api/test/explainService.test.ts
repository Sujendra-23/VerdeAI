import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
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

describe('localized explanations', () => {
  const service = new ExplainService(createRepository({} as NodeJS.ProcessEnv));
  const sample = MOCK_FORECASTS[0]!;
  it.each([
    ['kn', 'ಮುನ್ಸೂಚನೆ', 'ಮುನ್ಸೂಚಿತ'],
    ['hi', 'पूर्वानुमान', 'अनुमानित'],
    ['fr', 'prévision', 'prévision'],
    ['es', 'previsiones', 'previsión'],
  ])('localizes empty states and item replies in %s', async (locale, empty, item) => {
    const noData = await service.explain('missing', '1999-01-01', locale);
    expect(noData.explanation).toContain(empty);
    const reply = await service.chat(sample.restaurantId, sample.date, [{ role: 'user', content: sample.item }], locale);
    expect(reply.reply.content).toContain(item);
    expect(reply.reply.content).toContain(sample.item);
    expect(reply.reply.content).not.toContain('forecast is');
    const summary = await service.explain(sample.restaurantId, sample.date, locale);
    expect(summary.explanation).not.toContain('items are');
    expect(summary.explanation).not.toContain('Demand looks steady');
  });
  it('uses English for unsupported language values', async () => {
    const reply = await service.explain('missing', '1999-01-01', 'anything');
    expect(reply.explanation).toMatch(/No forecast data/);
  });
});


describe('Azure language selection', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
  beforeEach(() => {
    vi.stubEnv('AZURE_OPENAI_ENDPOINT', 'https://example.invalid/');
    vi.stubEnv('AZURE_OPENAI_DEPLOYMENT', 'test');
    vi.stubEnv('AZURE_OPENAI_API_KEY', 'test-key');
  });
  it('instructs Azure to reply in the selected language with a safe language name', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { choices: [{ message: { content: 'ಕನ್ನಡ ಉತ್ತರ' } }] } });
    const service = new ExplainService(createRepository({} as NodeJS.ProcessEnv));
    const sample = MOCK_FORECASTS[0]!;
    const result = await service.explain(sample.restaurantId, sample.date, 'kn-IN');
    expect(result.explanation).toBe('ಕನ್ನಡ ಉತ್ತರ');
    expect(result.source).toBe('azure-openai');
    expect(post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      messages: expect.arrayContaining([expect.objectContaining({ role: 'system', content: expect.stringContaining('Reply in Kannada (kn)') })]),
      max_tokens: 1000,
    }), expect.any(Object));
  });
  it('keeps the fallback localized if Azure fails', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('offline'));
    const result = await new ExplainService(createRepository({} as NodeJS.ProcessEnv)).explain('missing', '1999-01-01', 'kn');
    expect(result.source).toBe('template');
    expect(result.explanation).toContain('ಮುನ್ಸೂಚನೆ');
  });
});
