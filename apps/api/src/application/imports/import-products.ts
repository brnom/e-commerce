import { importRowSchema } from '@ecommerce/shared'

import { parseCsv } from './parse-csv'
import { InvalidImportFileError } from '@/domain/shared/domain-error'

import type { ImportJobRepository, ProductUpsert } from '@/application/ports/import-job-repository'
import type { ImportJob, ImportRowReport } from '@/domain/import/import-job'

export const MAX_IMPORT_ROWS = 5000

export interface ImportFile {
  readonly fileName: string
  readonly content: Buffer
}

const cellOrNull = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

export class ImportProducts {
  constructor(private readonly imports: ImportJobRepository) {}

  async execute(file: ImportFile): Promise<ImportJob> {
    const { records } = parseCsv(file.content)
    if (records.length > MAX_IMPORT_ROWS) {
      throw new InvalidImportFileError(`The file has more than ${MAX_IMPORT_ROWS} data rows`)
    }

    const rejected: ImportRowReport[] = []
    const writes: ProductUpsert[] = []
    const seen = new Map<string, number>()

    for (const record of records) {
      const sku = cellOrNull(record.cells.sku)
      const name = cellOrNull(record.cells.name)
      if (record.blank) {
        rejected.push({ line: record.line, sku, name, outcome: 'skipped', issues: [] })
        continue
      }
      const result = importRowSchema.safeParse(record.cells)
      if (!result.success) {
        const issues = result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }))
        rejected.push({ line: record.line, sku, name, outcome: 'failed', issues })
        continue
      }
      const row = result.data
      const firstLine = seen.get(row.sku)
      if (firstLine !== undefined) {
        rejected.push({
          line: record.line,
          sku: row.sku,
          name: row.name,
          outcome: 'failed',
          issues: [{ path: 'sku', message: `Duplicate of line ${firstLine}` }],
        })
        continue
      }
      seen.set(row.sku, record.line)
      writes.push({
        line: record.line,
        sku: row.sku,
        name: row.name,
        price: row.price,
        stock: row.stock,
        ...(row.description !== undefined && { description: row.description }),
        ...(row.weightKg !== undefined && { weightKg: row.weightKg }),
        ...(row.category !== undefined && { category: row.category }),
      })
    }

    return this.imports.commit({ fileName: file.fileName, rejected, writes })
  }
}
