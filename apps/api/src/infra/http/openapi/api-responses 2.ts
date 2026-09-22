import { ApiBadRequestResponse, ApiConflictResponse, ApiNotFoundResponse } from '@nestjs/swagger'

import {
  conflictErrorSchema,
  invalidImportFileErrorSchema,
  notFoundErrorSchema,
  unavailableItemsErrorSchema,
  validationErrorSchema,
} from './error-schemas'

export const ApiValidationFailure = (): MethodDecorator =>
  ApiBadRequestResponse({
    description: 'Validation failed, with one issue per failing field',
    standardSchema: validationErrorSchema,
  })

export const ApiResourceNotFound = (resource: string): MethodDecorator =>
  ApiNotFoundResponse({
    description: `No ${resource} answers to that id`,
    standardSchema: notFoundErrorSchema,
  })

export const ApiSkuConflict = (): MethodDecorator =>
  ApiConflictResponse({
    description: 'The SKU is taken, including by a deleted product',
    standardSchema: conflictErrorSchema,
  })

export const ApiUnavailableItems = (): MethodDecorator =>
  ApiConflictResponse({
    description: 'One or more items are not available in the requested quantity',
    standardSchema: unavailableItemsErrorSchema,
  })

export const ApiInvalidImportFile = (): MethodDecorator =>
  ApiBadRequestResponse({
    description: 'The file is missing, unreadable, empty or missing required columns',
    standardSchema: invalidImportFileErrorSchema,
  })
