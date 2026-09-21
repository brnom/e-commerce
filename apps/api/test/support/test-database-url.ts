export const DEFAULT_TEST_DATABASE_URL = "postgresql://app:app@localhost:5432/ecommerce_test";

export function testDatabaseUrl(): string {
  return process.env["TEST_DATABASE_URL"] ?? DEFAULT_TEST_DATABASE_URL;
}
