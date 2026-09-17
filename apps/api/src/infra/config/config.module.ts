import { Global, Module } from '@nestjs/common'

import { loadConfig } from './env-config'
import { CONFIG } from '@/application/ports/config'

@Global()
@Module({
  providers: [{ provide: CONFIG, useFactory: () => loadConfig() }],
  exports: [CONFIG],
})
export class ConfigModule {}
