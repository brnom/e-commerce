import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "@/app.module";
import { PrismaService } from "@/infra/persistence/prisma/prisma.service";

describe("GET /health", () => {
  let app: INestApplication;
  const prisma = {
    $queryRaw: async () => [{ "?column?": 1 }],
    onModuleInit: async () => undefined,
    onModuleDestroy: async () => undefined,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports ok when the database responds", async () => {
    const response = await request(app.getHttpServer()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.info.database.status).toBe("up");
  });

  it("reports error with 503 when the database query fails", async () => {
    prisma.$queryRaw = async () => {
      throw new Error("connection refused");
    };

    const response = await request(app.getHttpServer()).get("/health");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("error");
  });
});
