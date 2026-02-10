import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Convex handles freshness via WebSocket — queries never go stale
        staleTime: Infinity,
      },
    },
  });
}
