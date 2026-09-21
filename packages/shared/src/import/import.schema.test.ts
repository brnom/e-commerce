import { describe, expect, it } from 'vitest'

import { importRowSchema } from './import.schema'

const valid = { name: 'Running Shoes', sku: 'rs-001', price: '89.99', stock: '150' }

const failingPaths = (result: {
  success: boolean
  error?: { issues: { path: PropertyKey[] }[] }
}) => (result.success ? [] : result.error!.issues.map((issue) => issue.path.join('.')))

describe('importRowSchema', () => {
  it('coerces numeric cells and normalizes the sku', () => {
    const row = importRowSchema.parse({ ...valid, weight_kg: '0.35' })

    expect(row).toMatchObject({ sku: 'RS-001', price: 89.99, stock: 150, weightKg: 0.35 })
  })

  it('rejects a price with a currency symbol', () => {
    expect(failingPaths(importRowSchema.safeParse({ ...valid, price: '$29.99' }))).toEqual([
      'price',
    ])
  })

  it('rejects a word as a price', () => {
    expect(failingPaths(importRowSchema.safeParse({ ...valid, price: 'free' }))).toEqual(['price'])
  })

  it('rejects a thousands separator', () => {
    expect(failingPaths(importRowSchema.safeParse({ ...valid, price: '1,000' }))).toEqual(['price'])
  })

  it('rejects negative stock', () => {
    expect(failingPaths(importRowSchema.safeParse({ ...valid, stock: '-5' }))).toEqual(['stock'])
  })

  it('rejects a blank or whitespace name', () => {
    expect(failingPaths(importRowSchema.safeParse({ ...valid, name: '' }))).toEqual(['name'])
    expect(failingPaths(importRowSchema.safeParse({ ...valid, name: '   ' }))).toEqual(['name'])
  })

  it('rejects a blank required numeric cell', () => {
    expect(failingPaths(importRowSchema.safeParse({ ...valid, price: '' }))).toEqual(['price'])
  })

  it('reports every failing field of a row', () => {
    expect(failingPaths(importRowSchema.safeParse({ ...valid, name: '', stock: '-5' }))).toEqual([
      'name',
      'stock',
    ])
  })

  it('reads blank optional cells as null', () => {
    const row = importRowSchema.parse({ ...valid, description: '', category: ' ', weight_kg: '' })

    expect(row.description).toBeNull()
    expect(row.category).toBeNull()
    expect(row.weightKg).toBeNull()
  })

  it('keeps absent optional columns undefined', () => {
    const row = importRowSchema.parse(valid)

    expect(row.description).toBeUndefined()
    expect(row.category).toBeUndefined()
    expect(row.weightKg).toBeUndefined()
  })

  it('keeps commas inside text cells', () => {
    const row = importRowSchema.parse({ ...valid, description: 'Single origin, medium roast' })

    expect(row.description).toBe('Single origin, medium roast')
  })
})
