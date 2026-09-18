import type { UnavailableItem } from '@ecommerce/shared'

export class DomainValidationError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message)
    this.name = 'DomainValidationError'
  }
}

export class NotFoundError extends Error {
  constructor(
    readonly resource: string,
    readonly id: string,
  ) {
    super(`No ${resource} with id ${JSON.stringify(id)}`)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends Error {
  constructor(
    readonly field: string,
    readonly value: string,
  ) {
    super(`${field} ${JSON.stringify(value)} is already taken`)
    this.name = 'ConflictError'
  }
}

export class UnavailableItemsError extends Error {
  constructor(readonly items: readonly UnavailableItem[]) {
    super('Some items are not available in the requested quantity')
    this.name = 'UnavailableItemsError'
  }
}

export class InvalidImportFileError extends Error {
  constructor(
    message: string,
    readonly missingColumns: readonly string[] = [],
  ) {
    super(message)
    this.name = 'InvalidImportFileError'
  }
}
