/**
 * Shared types for the VerdeAI dashboard, API middleware, and Azure Functions.
 * Mirrors the Cosmos DB document shapes written by apps/functions.
 */

export interface Restaurant {
  restaurantId: string;
  name: string;
  location: string;
}

/** Mirrors a document in the `forecasts` Cosmos container. */
export interface ForecastRecord {
  id: string;
  restaurantId: string;
  date: string; // ISO date, e.g. "2026-02-05"
  item: string;
  predictedQuantity: number;
  historicalAverage: number;
}

export type RiskLevel = "HIGH" | "LOW";

/** Mirrors a document in the `waste_logs` Cosmos container. */
export interface WasteRiskRecord {
  id: string;
  restaurantId: string;
  date: string;
  item: string;
  predictedQuantity: number;
  riskScore: RiskLevel;
}

export interface ExplainRequest {
  restaurantId: string;
  date: string;
  locale?: SupportedLocale;
}

export interface ExplainResponse {
  restaurantId: string;
  date: string;
  explanation: string;
  source: "azure-openai" | "template";
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ExplainChatRequest {
  restaurantId: string;
  date: string;
  messages: ChatMessage[];
  locale?: SupportedLocale;
}

export const SUPPORTED_LOCALES = ["en", "kn", "hi", "fr", "es"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const LANGUAGE_NAMES: Record<SupportedLocale, string> = {
  en: "English", kn: "Kannada", hi: "Hindi", fr: "French", es: "Spanish",
};

/** Accept regional browser locales, with a safe English fallback. */
export function resolveLocale(value: unknown): SupportedLocale {
  if (typeof value !== "string") return "en";
  const base = value.toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LOCALES.find((locale) => locale === base) ?? "en";
}

export interface ExplainChatResponse {
  reply: ChatMessage;
  source: "azure-openai" | "template";
}

/** Combined view used by the GraphQL `insight` query — one round trip, three sources. */
export interface RestaurantInsight {
  restaurant: Restaurant;
  date: string;
  forecasts: ForecastRecord[];
  wasteRisk: WasteRiskRecord[];
  explanation: string;
}

/** Pure function shared by the API mock repository and the WasteRiskEngine function's logic. */
export function computeRiskLevel(
  predictedQuantity: number,
  historicalAverage: number,
): RiskLevel {
  return predictedQuantity > historicalAverage * 1.2 ? "HIGH" : "LOW";
}
