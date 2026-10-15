import type { ChatMessage, ExplainChatResponse, Restaurant, RestaurantInsight, SupportedLocale } from '@verdeai/shared-types';

export interface HealthStatus { status: 'ok'; dataSource: 'cosmos' | 'mock' }
export const insightQuery = `query Insight($restaurantId: String!, $date: String!, $locale: String!) {
  insight(restaurantId: $restaurantId, date: $date, locale: $locale) {
    restaurant { restaurantId name location } date
    forecasts { id restaurantId date item predictedQuantity historicalAverage }
    wasteRisk { id restaurantId date item predictedQuantity riskScore }
    explanation
  }
}`;

/** Mobile clients must use a public HTTPS origin; backend credentials stay on the server. */
export function createMobileClient(baseUrl: string, transport: typeof fetch = fetch) {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Configure a public HTTPS API origin without credentials, path, query, or fragment.');
  }
  async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timeout = setTimeout(abort, 45000);
    try {
      const response = await transport(`${url.origin}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`API request failed (${response.status}).`);
      return await response.json() as T;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }
  return {
    health: (signal?: AbortSignal) => request<HealthStatus>('/api/health', undefined, signal),
    restaurants: (signal?: AbortSignal) => request<Restaurant[]>('/api/restaurants', undefined, signal),
    async insight(restaurantId: string, date: string, locale: SupportedLocale, signal?: AbortSignal): Promise<RestaurantInsight> {
      const result = await request<{ data?: { insight?: RestaurantInsight }; errors?: { message: string }[] }>('/graphql', {
        query: insightQuery, variables: { restaurantId, date, locale },
      }, signal);
      if (result.errors?.length || !result.data?.insight) throw new Error('Could not load the restaurant insight.');
      return result.data.insight;
    },
    chat: (restaurantId: string, date: string, messages: ChatMessage[], locale: SupportedLocale, signal?: AbortSignal) =>
      request<ExplainChatResponse>('/api/explain/chat', { restaurantId, date, messages, locale }, signal),
  };
}

/** API calendar dates must not shift when the device changes time zones. */
export function calendarDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
