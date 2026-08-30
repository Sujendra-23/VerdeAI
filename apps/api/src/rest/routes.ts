import { Router } from "express";
import type { ChatMessage } from "@verdeai/shared-types";
import type { Repository } from "../data/repository.js";
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

export function createRestRouter(repository: Repository, explainService: ExplainService): Router {
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
    const { restaurantId, date } = req.body ?? {};
    if (!restaurantId || !date) {
      res.status(400).json({ error: "restaurantId and date are required" });
      return;
    }
    const result = await explainService.explain(restaurantId, date);
    res.json({ restaurantId, date, ...result });
  });

  router.post("/explain/chat", async (req, res) => {
    const { restaurantId, date, messages } = req.body ?? {};
    if (!restaurantId || !date || !Array.isArray(messages)) {
      res.status(400).json({ error: "restaurantId, date, and messages[] are required" });
      return;
    }
    const result = await explainService.chat(
      restaurantId,
      date,
      messages as ChatMessage[],
    );
    res.json(result);
  });

  return router;
}
