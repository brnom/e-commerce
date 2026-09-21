import { Injectable } from '@nestjs/common'
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus'

import { PrismaService } from '@/infra/persistence/prisma/prisma.service'

@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key)
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return indicator.up()
    } catch {
      return indicator.down({ message: 'database query failed' })
    }
  }
}
