import { describe, expect, it } from 'vitest'

import { DomainExceptionFilter } from './domain-exception.filter'
import { ConflictError, DomainValidationError, NotFoundError } from '@/domain/shared/domain-error'

import type { ArgumentsHost } from '@nestjs/common'

function fakeHost() {
  const sent: { status?: number; body?: unknown } = {}
  const response = {
    status(code: number) {
      sent.status = code
      return this
    },
    json(body: unknown) {
      sent.body = body
    },
  }
  const host = { switchToHttp: () => ({ getResponse: () => response }) } as ArgumentsHost
  return { host, sent }
}

describe('DomainExceptionFilter', () => {
  const filter = new DomainExceptionFilter()

  it('maps NotFoundError to 404', () => {
    const { host, sent } = fakeHost()

    filter.catch(new NotFoundError('product', 'abc'), host)

    expect(sent.status).toBe(404)
    expect(sent.body).toMatchObject({ resource: 'product' })
  })

  it('maps ConflictError to 409 naming the field and value', () => {
    const { host, sent } = fakeHost()

    filter.catch(new ConflictError('sku', 'RS-001'), host)

    expect(sent.status).toBe(409)
    expect(sent.body).toEqual({
      message: 'sku "RS-001" is already taken',
      field: 'sku',
      value: 'RS-001',
    })
  })

  it('maps DomainValidationError to 400 with an issues list', () => {
    const { host, sent } = fakeHost()

    filter.catch(new DomainValidationError('stock', 'must not be negative'), host)

    expect(sent.status).toBe(400)
    expect(sent.body).toEqual({
      message: 'Validation failed',
      issues: [{ path: 'stock', message: 'must not be negative' }],
    })
  })
})
