import { useQuery } from "@tanstack/react-query";
import { fetchRestaurants } from "../api/client";

export function useRestaurants() {
  return useQuery({
    queryKey: ["restaurants"],
    queryFn: fetchRestaurants,
    staleTime: 60_000,
  });
}
