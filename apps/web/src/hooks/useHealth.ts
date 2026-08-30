import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "../api/client";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    staleTime: 30_000,
    retry: 1,
  });
}
