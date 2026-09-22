import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common'
import { ZodType } from 'zod'

@Injectable()
export class ZodValidationPipe implements PipeTransform<unknown, unknown> {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const schema = metadata.schema as ZodType | undefined
    if (!schema) {
      throw new Error(`The ${metadata.type} parameter was declared without a schema`)
    }
    const result = schema.safeParse(value)
    if (result.success) {
      return result.data
    }
    throw new BadRequestException({
      message: 'Validation failed',
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }
}
