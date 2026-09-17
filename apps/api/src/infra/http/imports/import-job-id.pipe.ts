import { Injectable } from '@nestjs/common'

import { ResourceIdPipe } from '../resource-id.pipe'

@Injectable()
export class ImportJobIdPipe extends ResourceIdPipe {
  constructor() {
    super('import')
  }
}
