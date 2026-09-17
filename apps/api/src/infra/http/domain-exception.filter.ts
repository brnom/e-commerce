import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common'

import {
  ConflictError,
  DomainValidationError,
  InvalidImportFileError,
  NotFoundError,
} from '@/domain/shared/domain-error'

import type { Response } from 'express'

type DomainException =
  DomainValidationError | NotFoundError | ConflictError | InvalidImportFileError

@Catch(DomainValidationError, NotFoundError, ConflictError, InvalidImportFileError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    if (exception instanceof NotFoundError) {
      response.status(404).json({ message: exception.message, resource: exception.resource })
      return
    }
    if (exception instanceof ConflictError) {
      response
        .status(409)
        .json({ message: exception.message, field: exception.field, value: exception.value })
      return
    }
    if (exception instanceof InvalidImportFileError) {
      response
        .status(400)
        .json({ message: exception.message, missingColumns: exception.missingColumns })
      return
    }
    response.status(400).json({
      message: 'Validation failed',
      issues: [{ path: exception.field, message: exception.message }],
    })
  }
}
