import { countOutcomes } from '@/domain/import/import-job'

import type { ImportJobRepository, ImportPlan } from '@/application/ports/import-job-repository'
import type { InMemoryCategoryRepository } from '@/application/products/__fakes__/in-memory-category-repository'
import type { InMemoryProductRepository } from '@/application/products/__fakes__/in-memory-product-repository'
import type { ImportJob, ImportJobSummary, ImportRowReport } from '@/domain/import/import-job'

export class InMemoryImportJobRepository implements ImportJobRepository {
  readonly jobs: ImportJob[] = []

  constructor(
    private readonly products: InMemoryProductRepository,
    private readonly categories: InMemoryCategoryRepository,
  ) {}

  async commit(plan: ImportPlan): Promise<ImportJob> {
    const written: ImportRowReport[] = []
    for (const write of plan.writes) {
      const categoryId =
        write.category === undefined
          ? undefined
          : write.category === null
            ? null
            : (await this.categories.findOrCreate(write.category)).id
      const existing = this.products.rows.find((row) => row.sku === write.sku)
      const now = new Date()
      if (existing) {
        Object.assign(existing, {
          name: write.name,
          price: write.price,
          stock: write.stock,
          ...(write.description !== undefined && { description: write.description }),
          ...(write.weightKg !== undefined && { weightKg: write.weightKg }),
          ...(categoryId !== undefined && { categoryId }),
          deletedAt: null,
          updatedAt: now,
        })
      } else {
        this.products.rows.push({
          id: `product-${this.products.rows.length + 1}`,
          sku: write.sku,
          name: write.name,
          description: write.description ?? null,
          price: write.price,
          stock: write.stock,
          weightKg: write.weightKg ?? null,
          categoryId: categoryId ?? null,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        })
      }
      written.push({
        line: write.line,
        sku: write.sku,
        name: write.name,
        outcome: existing ? 'updated' : 'created',
        issues: [],
      })
    }
    const rows = [...plan.rejected, ...written].sort((a, b) => a.line - b.line)
    const job: ImportJob = {
      id: `import-${this.jobs.length + 1}`,
      fileName: plan.fileName,
      createdAt: new Date(),
      totals: countOutcomes(rows),
      rows,
    }
    this.jobs.push(job)
    return job
  }

  async findById(id: string): Promise<ImportJob | null> {
    return this.jobs.find((job) => job.id === id) ?? null
  }

  async findAll(): Promise<ImportJobSummary[]> {
    return [...this.jobs].reverse().map(({ rows: _rows, ...summary }) => summary)
  }
}
