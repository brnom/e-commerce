import { parseApiEnv } from "@ecommerce/shared";

import type { Config } from "@/application/ports/config";

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = parseApiEnv(env);
  return {
    port: parsed.API_PORT,
    databaseUrl: parsed.DATABASE_URL,
    webOrigin: parsed.WEB_ORIGIN,
  };
}
