"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

type HealthResponse = { status: "ok" | "error" };

export function ApiHealth() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiClient<HealthResponse>("/health"),
    refetchInterval: 10_000,
  });

  const label = isPending ? "checking" : isError ? "unreachable" : data.status;

  return (
    <p data-testid="api-health" aria-live="polite">
      API: {label}
    </p>
  );
}
