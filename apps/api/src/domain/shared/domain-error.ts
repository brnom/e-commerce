export class DomainValidationError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(
    readonly resource: string,
    readonly id: string,
  ) {
    super(`No ${resource} with id ${JSON.stringify(id)}`);
    this.name = "NotFoundError";
  }
}
