import type { ImportJob, ImportJobSummary, ImportRowReport } from '@/domain/import/import-job'

export interface ProductUpsert {
  readonly line: number
  readonly sku: string
  readonly name: string
  readonly description?: string | null
  readonly price: number
  readonly stock: number
  readonly weightKg?: number | null
  readonly category?: string | null
}

export interface ImportPlan {
  readonly fileName: string
  readonly rejected: ImportRowReport[]
  readonly writes: ProductUpsert[]
}

export interface ImportJobRepository {
  commit(plan: ImportPlan): Promise<ImportJob>
  findById(id: string): Promise<ImportJob | null>
  findAll(): Promise<ImportJobSummary[]>
}

export const IMPORT_JOB_REPOSITORY = Symbol('ImportJobRepository')
