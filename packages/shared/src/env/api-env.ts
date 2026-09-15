import { z } from "zod";

export const apiEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.url().default("http://localhost:3000"),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function parseApiEnv(source: Record<string, string | undefined>): ApiEnv {
  const result = apiEnvSchema.safeParse(source);
  if (result.success) {
    return result.data;
  }
  const missing = result.error.issues
    .map((issue) => issue.path.join("."))
    .filter((path, index, all) => all.indexOf(path) === index);
  throw new Error(`Invalid environment configuration: ${missing.join(", ")}`);
}
