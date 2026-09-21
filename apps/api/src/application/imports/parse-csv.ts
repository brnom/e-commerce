import {
  importColumns,
  requiredImportColumns,
  type ImportCells,
  type ImportColumn,
} from '@ecommerce/shared'
import { parse } from 'csv-parse/sync'

import { InvalidImportFileError } from '@/domain/shared/domain-error'

export interface ParsedRecord {
  readonly line: number
  readonly cells: ImportCells
  readonly blank: boolean
}

export interface ParsedCsv {
  readonly columns: ImportColumn[]
  readonly records: ParsedRecord[]
}

const knownColumns = new Set<string>(importColumns)

const isImportColumn = (name: string): name is ImportColumn => knownColumns.has(name)

const normalizeHeader = (header: string) => header.trim().toLowerCase()

const newlines = (value: string) => value.split('\n').length - 1

type RawRecord = { info: { lines: number }; record: Record<string, string> }

export function parseCsv(content: Buffer | string): ParsedCsv {
  let columns: ImportColumn[] = []
  let raw: RawRecord[]
  try {
    raw = parse(content, {
      bom: true,
      relax_column_count: true,
      skip_empty_lines: false,
      info: true,
      columns: (header: string[]) => {
        columns = header.map(normalizeHeader).filter(isImportColumn)
        return header.map(normalizeHeader).map((name) => (isImportColumn(name) ? name : undefined))
      },
    }) as RawRecord[]
  } catch (error) {
    throw new InvalidImportFileError(
      `The file is not valid CSV: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const missing = requiredImportColumns.filter((name) => !columns.includes(name))
  if (missing.length > 0) {
    throw new InvalidImportFileError(`Missing required columns: ${missing.join(', ')}`, missing)
  }
  if (raw.length === 0) {
    throw new InvalidImportFileError('The file has no data rows')
  }

  const records = raw.map(({ info, record }) => {
    const cells: ImportCells = {}
    let blank = true
    let embeddedLines = 0
    for (const column of columns) {
      const value = record[column] ?? ''
      cells[column] = value
      if (value.trim() !== '') blank = false
      embeddedLines += newlines(value)
    }
    return { line: info.lines - embeddedLines, cells, blank }
  })

  return { columns, records }
}
