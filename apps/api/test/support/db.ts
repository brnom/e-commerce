import { testDatabaseUrl } from "./test-database-url";
import { PrismaService } from "@/infra/persistence/prisma/prisma.service";

export function createTestPrisma(): PrismaService {
  return new PrismaService({ databaseUrl: testDatabaseUrl(), port: 0, webOrigin: "" });
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Product", "Category" CASCADE');
}
