import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { parseCsv } from './parse-csv'
import { InvalidImportFileError } from '@/domain/shared/domain-error'

const header = 'name,sku,description,category,price,stock,weight_kg\n'

describe('parseCsv', () => {
  it('keeps commas inside quoted cells', () => {
    const { records } = parseCsv(
      `${header}Coffee,CB-010,"Single origin, medium roast, 1kg bag",Food & Beverage,18.75,500,1.0\n`,
    )

    expect(records).toHaveLength(1)
    expect(records[0]!.cells.description).toBe('Single origin, medium roast, 1kg bag')
    expect(records[0]!.line).toBe(2)
  })

  it('matches headers case-insensitively and ignores unknown columns', () => {
    const { columns, records } = parseCsv(
      'SKU,Name , Price,Stock,Weight_kg,Supplier\nrs-1,Shoes,1,2,0.5,Acme\n',
    )

    expect(columns).toEqual(['sku', 'name', 'price', 'stock', 'weight_kg'])
    expect(records[0]!.cells).toEqual({
      sku: 'rs-1',
      name: 'Shoes',
      price: '1',
      stock: '2',
      weight_kg: '0.5',
    })
    expect(records[0]!.cells.description).toBeUndefined()
  })

  it('tolerates a byte-order mark', () => {
    const { columns } = parseCsv(`﻿${header}A,B,,,1,1,\n`)

    expect(columns[0]).toBe('name')
  })

  it('lists every missing required column', () => {
    expect(() => parseCsv('name,description,category\nA,B,C\n')).toThrow(
      new InvalidImportFileError('Missing required columns: sku, price, stock', [
        'sku',
        'price',
        'stock',
      ]),
    )
  })

  it('rejects an unterminated quote', () => {
    expect(() => parseCsv(`${header}"Shoes,RS-1,,,1,1,\n`)).toThrow(InvalidImportFileError)
  })

  it('rejects a file without data rows', () => {
    expect(() => parseCsv(header)).toThrow(new InvalidImportFileError('The file has no data rows'))
    expect(() => parseCsv('')).toThrow(InvalidImportFileError)
  })

  it('keeps blank lines as blank records with their line number', () => {
    const { records } = parseCsv(`${header},,,,,,\n\nShoes,RS-1,,,1,1,\n`)

    expect(records.map((record) => [record.line, record.blank])).toEqual([
      [2, true],
      [3, true],
      [4, false],
    ])
  })

  it('reads a short line as blank cells', () => {
    const { records } = parseCsv(`${header}Shoes,RS-1\n`)

    expect(records[0]!.cells).toMatchObject({ name: 'Shoes', sku: 'RS-1', price: '', stock: '' })
  })

  it('numbers a record by the line it starts on', () => {
    const { records } = parseCsv(`${header}Shoes,RS-1,"two\nlines",,1,1,\nHat,HT-1,,,1,1,\n`)

    expect(records.map((record) => record.line)).toEqual([2, 4])
  })

  it('parses the sample file into 97 records', () => {
    const sample = readFileSync(resolve(__dirname, '../../../../../data/e-commerce_input.csv'))

    const { records } = parseCsv(sample)

    expect(records).toHaveLength(97)
    expect(records.filter((record) => record.blank).map((record) => record.line)).toEqual([62, 63])
  })
})
