import { Controller, Get } from '@nestjs/common'
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger'
import { HealthCheck, HealthCheckResult, HealthCheckService } from '@nestjs/terminus'

import { PrismaHealthIndicator } from './prisma-health.indicator'
import { healthReportSchema } from '../openapi/error-schemas'

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness plus a database check' })
  @ApiOkResponse({ description: 'Every check is up', standardSchema: healthReportSchema })
  @ApiServiceUnavailableResponse({
    description: 'At least one check is down',
    standardSchema: healthReportSchema,
  })
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.prismaIndicator.isHealthy('database')])
  }
}
