"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type HealthResponse = { status: "ok" | "error" };

export function ApiHealth({ className }: { className?: string }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiClient<HealthResponse>("/health"),
    refetchInterval: 10_000,
  });

  const label = isPending ? "checking" : isError ? "unreachable" : data.status;
  const healthy = label === "ok";

  return (
    <p
      data-testid="api-health"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 font-mono text-xs tracking-wider uppercase",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2 rounded-full",
          healthy ? "bg-foreground" : "border border-foreground bg-transparent",
        )}
      />
      API: {label}
    </p>
  );
}
