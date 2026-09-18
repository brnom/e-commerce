import { Injectable } from '@nestjs/common'

import { ResourceIdPipe } from '../resource-id.pipe'

@Injectable()
export class OrderIdPipe extends ResourceIdPipe {
  constructor() {
    super('order')
  }
}
