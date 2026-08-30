import { useQuery } from "@tanstack/react-query";
import { fetchInsight } from "../api/client";

export function useInsight(restaurantId: string, date: string) {
  return useQuery({
    queryKey: ["insight", restaurantId, date],
    queryFn: () => fetchInsight(restaurantId, date),
    enabled: Boolean(restaurantId && date),
  });
}
