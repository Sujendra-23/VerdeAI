import { Router } from "express";
import { isExperimentId, isLanguagePreference, type ChatMessage, type ExperimentEvent } from "@verdeai/shared-types";
import type { Repository } from "../data/repository.js";
import type { ExperimentStore } from "../services/experimentStore.js";
import type { ExplainService } from "../services/explainService.js";

function requireQueryParams(
  query: Record<string, unknown>,
  names: string[],
): string[] | null {
  const values = names.map((name) => query[name]);
  if (values.some((v) => typeof v !== "string" || v.length === 0)) {
    return null;
  }
  return values as string[];
}

export function createRestRouter(
  repository: Repository,
  explainService: ExplainService,
  experimentStore: ExperimentStore,
): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ status: "ok", dataSource: repository.mode });
  });

  router.get("/restaurants", async (_req, res) => {
    const restaurants = await repository.listRestaurants();
    res.json(restaurants);
  });

  router.get("/forecasts", async (req, res) => {
    const params = requireQueryParams(req.query as Record<string, unknown>, [
      "restaurantId",
      "date",
    ]);
    if (!params) {
      res.status(400).json({ error: "restaurantId and date query params are required" });
      return;
    }
    const [restaurantId, date] = params;
    const forecasts = await repository.getForecasts(restaurantId!, date!);
    res.json(forecasts);
  });

  router.get("/waste-risk", async (req, res) => {
    const params = requireQueryParams(req.query as Record<string, unknown>, [
      "restaurantId",
      "date",
    ]);
    if (!params) {
      res.status(400).json({ error: "restaurantId and date query params are required" });
      return;
    }
    const [restaurantId, date] = params;
    const wasteRisk = await repository.getWasteRisk(restaurantId!, date!);
    res.json(wasteRisk);
  });

  router.post("/explain", async (req, res) => {
    const { restaurantId, date, locale, language } = req.body ?? {};
    if (!restaurantId || !date) {
      res.status(400).json({ error: "restaurantId and date are required" });
      return;
    }
    if (language !== undefined && !isLanguagePreference(language)) { res.status(400).json({ error: "language must be auto or a supported language code" }); return; }
    const result = await explainService.explain(restaurantId, date, language, language === undefined ? locale : undefined);
    res.json({ restaurantId, date, ...result });
  });

  router.post("/explain/chat", async (req, res) => {
    const { restaurantId, date, messages, locale, language } = req.body ?? {};
    if (!restaurantId || !date || !Array.isArray(messages)) {
      res.status(400).json({ error: "restaurantId, date, and messages[] are required" });
      return;
    }
    if (language !== undefined && !isLanguagePreference(language)) { res.status(400).json({ error: "language must be auto or a supported language code" }); return; }
    const result = await explainService.chat(
      restaurantId,
      date,
      messages as ChatMessage[],
      language,
      language === undefined ? locale : undefined,
    );
    res.json(result);
  });

  // One exposure or conversion per request. Rejected events get a 400 with the reason;
  // duplicates and conversions without an exposure are accepted but not counted (202).
  router.post("/experiments/events", (req, res) => {
    const outcome = experimentStore.record((req.body ?? {}) as ExperimentEvent);
    if (outcome.status === "invalid") {
      res.status(400).json({ error: outcome.reason });
      return;
    }
    res.status(outcome.status === "recorded" ? 201 : 202).json({ status: outcome.status });
  });

  router.get("/experiments/:experimentId/results", (req, res) => {
    const { experimentId } = req.params;
    if (!isExperimentId(experimentId)) {
      res.status(404).json({ error: "unknown experiment" });
      return;
    }
    res.json(experimentStore.results(experimentId));
  });

  return router;
}
