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

/** Languages the explain chatbot can answer in. `nativeName` is what the selector shows. */
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

/** `auto` = answer in the language the manager wrote their last message in. */
export type LanguagePreference = LanguageCode | "auto";

export function isLanguageCode(value: unknown): value is LanguageCode {
  return SUPPORTED_LANGUAGES.some((l) => l.code === value);
}

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === "auto" || isLanguageCode(value);
}

export interface ExplainChatRequest {
  restaurantId: string;
  date: string;
  messages: ChatMessage[];
  /** Defaults to `auto` when omitted. */
  language?: LanguagePreference;
}

export interface ExplainChatResponse {
  reply: ChatMessage;
  source: "azure-openai" | "template";
  /** The language the reply was produced in (after auto-detection). */
  language: LanguageCode;
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

/** A food-bank pickup booked for surplus of a forecast item. */
export type BookingStatus = "confirmed" | "cancelled";

export interface Booking {
  id: string;
  restaurantId: string;
  date: string; // ISO date the pickup happens
  slot: string; // "HH:MM" start of a 30-minute pickup slot
  item: string;
  quantity: number;
  contactName: string;
  notes?: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}
