import type { ImportRowReport, ImportTotals } from '@ecommerce/shared'

export type { ImportIssue, ImportOutcome, ImportRowReport, ImportTotals } from '@ecommerce/shared'

export interface ImportJobSummary {
  readonly id: string
  readonly fileName: string
  readonly createdAt: Date
  readonly totals: ImportTotals
}

export interface ImportJob extends ImportJobSummary {
  readonly rows: ImportRowReport[]
}

export function countOutcomes(rows: readonly ImportRowReport[]): ImportTotals {
  const totals = { rows: rows.length, created: 0, updated: 0, skipped: 0, failed: 0 }
  for (const row of rows) totals[row.outcome] += 1
  return totals
}
