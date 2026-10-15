import { useQuery } from "@tanstack/react-query";
import { fetchInsight } from "../api/client";

import { useLanguageStore } from "../i18n";

export function useInsight(restaurantId: string, date: string) {
  const locale = useLanguageStore((s) => s.locale);
  return useQuery({
    queryKey: ["insight", restaurantId, date, locale],
    queryFn: () => fetchInsight(restaurantId, date, locale),
    enabled: Boolean(restaurantId && date),
  });
}
