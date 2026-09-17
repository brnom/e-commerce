import { PipeTransform } from '@nestjs/common'
import { z } from 'zod'

import { NotFoundError } from '@/domain/shared/domain-error'

const uuid = z.uuid()

export abstract class ResourceIdPipe implements PipeTransform<string, string> {
  protected constructor(private readonly resource: string) {}

  transform(value: string): string {
    if (!uuid.safeParse(value).success) {
      throw new NotFoundError(this.resource, value)
    }
    return value
  }
}
