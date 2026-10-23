import type {
  ChatMessage,
  ExperimentId,
  ExperimentResults,
  LanguagePreference,
  ExplainChatResponse,
  Restaurant,
  RestaurantInsight,
  SupportedLocale,
} from "@verdeai/shared-types";

const API_URL = import.meta.env.VITE_API_URL ?? "";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface HealthStatus {
  status: "ok";
  dataSource: "cosmos" | "mock";
}

export function fetchHealth(): Promise<HealthStatus> {
  return http<HealthStatus>("/api/health");
}

export function fetchRestaurants(): Promise<Restaurant[]> {
  return http<Restaurant[]>("/api/restaurants");
}

// Forecast + waste-risk + AI explanation for a restaurant/date, in one round
// trip — the concrete win GraphQL gives us over stitching together three
// separate REST calls (which is what the plain REST endpoints below require).
const INSIGHT_QUERY = /* GraphQL */ `
  query Insight($restaurantId: String!, $date: String!, $locale: String!) {
    insight(restaurantId: $restaurantId, date: $date, locale: $locale) {
      restaurant {
        restaurantId
        name
        location
      }
      date
      forecasts {
        id
        restaurantId
        date
        item
        predictedQuantity
        historicalAverage
      }
      wasteRisk {
        id
        restaurantId
        date
        item
        predictedQuantity
        riskScore
      }
      explanation
    }
  }
`;

export async function fetchInsight(
  restaurantId: string,
  date: string,
  locale: SupportedLocale = "en",
): Promise<RestaurantInsight> {
  const res = await fetch(`${API_URL}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: INSIGHT_QUERY,
      variables: { restaurantId, date, locale },
    }),
  });
  if (!res.ok) throw new Error(`Insight request failed: ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0].message as string);
  }
  return json.data.insight as RestaurantInsight;
}

export function postExplainChat(
  restaurantId: string,
  date: string,
  messages: ChatMessage[],
  locale: SupportedLocale | undefined = "en",
  language?: LanguagePreference,
): Promise<ExplainChatResponse> {
  return http<ExplainChatResponse>("/api/explain/chat", {
    method: "POST",
    body: JSON.stringify({ restaurantId, date, messages, locale, language }),
  });
}

export function fetchExperimentResults(experimentId: ExperimentId): Promise<ExperimentResults> {
  return http<ExperimentResults>(`/api/experiments/${experimentId}/results`);
}
