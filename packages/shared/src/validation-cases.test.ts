import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { importRowSchema } from './import/import.schema'
import { createPlaceOrderSchema } from './order/order.schema'
import { createProductSchema } from './product/product.schema'

import type { ZodType } from 'zod'

interface ValidationCase {
  readonly name: string
  readonly patch?: Record<string, unknown>
  readonly input?: Record<string, unknown>
  readonly now?: string
  readonly issues: ReadonlyArray<{ readonly path: string; readonly message: string }>
}

interface CaseFile {
  readonly base: Record<string, unknown>
  readonly cases: ValidationCase[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>) {
  const merged: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    const current = merged[key]
    merged[key] = isRecord(current) && isRecord(value) ? deepMerge(current, value) : value
  }
  return merged
}

function loadCases(file: string): CaseFile {
  return JSON.parse(
    readFileSync(resolve(__dirname, '..', 'validation-cases', file), 'utf8'),
  ) as CaseFile
}

function issuesOf(schema: ZodType, input: unknown) {
  const result = schema.safeParse(input)
  return result.success
    ? []
    : result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
}

const suites: Array<[string, (testCase: ValidationCase) => ZodType]> = [
  ['product.json', () => createProductSchema],
  ['import-row.json', () => importRowSchema],
  [
    'order.json',
    (testCase) =>
      createPlaceOrderSchema(() => (testCase.now ? new Date(testCase.now) : new Date())),
  ],
]

describe.each(suites)('validation cases in %s', (file, schemaFor) => {
  const { base, cases } = loadCases(file)

  it.each(cases.map((testCase) => [testCase.name, testCase] as const))('%s', (_, testCase) => {
    const input = testCase.input ?? deepMerge(base, testCase.patch ?? {})

    expect(issuesOf(schemaFor(testCase), input)).toEqual(testCase.issues)
  })
})
