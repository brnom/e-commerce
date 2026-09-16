import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";

import { ConfigModule } from "./infra/config/config.module";
import { DomainExceptionFilter } from "./infra/http/domain-exception.filter";
import { HealthModule } from "./infra/http/health/health.module";
import { PrismaModule } from "./infra/persistence/prisma/prisma.module";

@Module({
  imports: [ConfigModule, PrismaModule, HealthModule],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
