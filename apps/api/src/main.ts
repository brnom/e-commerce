import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
import { CONFIG, type Config } from './application/ports/config'
import { setupOpenApi } from './infra/http/openapi/openapi'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const config = app.get<Config>(CONFIG)
  app.enableCors({ origin: config.webOrigin })
  setupOpenApi(app)
  app.enableShutdownHooks()
  await app.listen(config.port)
}

void bootstrap()
