import { z } from 'zod'

import { createProductSchema } from '../product/product.schema'

export const importColumns = [
  'name',
  'sku',
  'description',
  'category',
  'price',
  'stock',
  'weight_kg',
] as const

export const requiredImportColumns = ['name', 'sku', 'price', 'stock'] as const

export type ImportColumn = (typeof importColumns)[number]

export type ImportCells = Partial<Record<ImportColumn, string | null>>

const DECIMAL = /^-?\d+(\.\d+)?$/

const text = (cell: string | null | undefined) => {
  if (cell == null) return undefined
  return cell.trim() === '' ? undefined : cell
}

const optionalText = (cell: string | null | undefined) => {
  if (cell === undefined) return undefined
  if (cell === null || cell.trim() === '') return null
  return cell
}

const number = (cell: string | null | undefined) => {
  if (cell == null) return undefined
  const trimmed = cell.trim()
  if (trimmed === '') return undefined
  return DECIMAL.test(trimmed) ? Number(trimmed) : trimmed
}

const optionalNumber = (cell: string | null | undefined) => {
  if (cell === undefined) return undefined
  if (cell === null || cell.trim() === '') return null
  return number(cell)
}

export const importRowSchema = z.preprocess((cells) => {
  const row = (cells ?? {}) as ImportCells
  return {
    sku: text(row.sku),
    name: text(row.name),
    description: optionalText(row.description),
    category: optionalText(row.category),
    price: number(row.price),
    stock: number(row.stock),
    weightKg: optionalNumber(row.weight_kg),
  }
}, createProductSchema)

export const importOutcomes = ['created', 'updated', 'skipped', 'failed'] as const

export const importIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
})

export const importRowReportSchema = z.object({
  line: z.number().int().min(2),
  sku: z.string().nullable(),
  name: z.string().nullable(),
  outcome: z.enum(importOutcomes),
  issues: z.array(importIssueSchema),
})

export const importTotalsSchema = z.object({
  rows: z.number().int(),
  created: z.number().int(),
  updated: z.number().int(),
  skipped: z.number().int(),
  failed: z.number().int(),
})

export const importJobSummarySchema = z.object({
  id: z.uuid(),
  fileName: z.string(),
  createdAt: z.string(),
  totals: importTotalsSchema,
})

export const importJobSchema = importJobSummarySchema.extend({
  rows: z.array(importRowReportSchema),
})

export type ImportRow = z.output<typeof importRowSchema>
export type ImportOutcome = (typeof importOutcomes)[number]
export type ImportIssue = z.infer<typeof importIssueSchema>
export type ImportRowReport = z.infer<typeof importRowReportSchema>
export type ImportTotals = z.infer<typeof importTotalsSchema>
export type ImportJobSummary = z.infer<typeof importJobSummarySchema>
export type ImportJob = z.infer<typeof importJobSchema>
