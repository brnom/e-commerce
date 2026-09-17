import { Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'

import { ConfigModule } from './infra/config/config.module'
import { DomainExceptionFilter } from './infra/http/domain-exception.filter'
import { HealthModule } from './infra/http/health/health.module'
import { ImportsModule } from './infra/http/imports/imports.module'
import { ProductsModule } from './infra/http/products/products.module'
import { PrismaModule } from './infra/persistence/prisma/prisma.module'

@Module({
  imports: [ConfigModule, PrismaModule, HealthModule, ProductsModule, ImportsModule],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
