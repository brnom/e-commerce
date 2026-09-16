import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";

import { DomainValidationError, NotFoundError } from "@/domain/shared/domain-error";

import type { Response } from "express";

@Catch(DomainValidationError, NotFoundError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainValidationError | NotFoundError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof NotFoundError) {
      response.status(404).json({ message: exception.message, resource: exception.resource });
      return;
    }
    response.status(400).json({
      message: "Validation failed",
      issues: [{ path: exception.field, message: exception.message }],
    });
  }
}
