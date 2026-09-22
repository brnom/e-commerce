import { BadRequestException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { ZodValidationPipe } from './zod-validation.pipe'

import type { ArgumentMetadata } from '@nestjs/common'

const schema = z.object({ name: z.string().min(1), price: z.number().nonnegative() })

const body: ArgumentMetadata = { type: 'body', schema }

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe()

  it('returns the parsed value for a valid payload', () => {
    expect(pipe.transform({ name: 'Lamp', price: 10 }, body)).toEqual({ name: 'Lamp', price: 10 })
  })

  it('throws a 400 listing every issue for an invalid payload', () => {
    let caught: unknown
    try {
      pipe.transform({ name: '', price: -1 }, body)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(BadRequestException)
    const response = (caught as BadRequestException).getResponse() as {
      message: string
      issues: Array<{ path: string; message: string }>
    }
    expect(response.message).toBe('Validation failed')
    expect(response.issues.map((issue) => issue.path)).toEqual(['name', 'price'])
  })

  it('fails loudly when the parameter was declared without a schema', () => {
    expect(() => pipe.transform({}, { type: 'body' })).toThrow(
      'The body parameter was declared without a schema',
    )
  })
})
