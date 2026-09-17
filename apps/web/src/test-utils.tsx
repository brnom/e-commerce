import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { vi } from "vitest";

import type { ReactElement } from "react";

export function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

type Route = { method?: string; path: RegExp; status?: number; body?: unknown };

export function stubApi(routes: Route[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? "GET";
    const route = routes.find(
      (candidate) => (candidate.method ?? "GET") === method && candidate.path.test(url),
    );
    if (!route) {
      throw new Error(`Unexpected request ${method} ${url}`);
    }
    const status = route.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(route.body ?? null), { status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export const calls = (fetchMock: ReturnType<typeof stubApi>, method: string) =>
  fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method);
