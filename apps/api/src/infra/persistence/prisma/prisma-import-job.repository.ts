import { Injectable } from '@nestjs/common'

import { upsertCategory } from './category-upsert'
import { PrismaService } from './prisma.service'
import { countOutcomes } from '@/domain/import/import-job'

import type {
  ImportJobRepository,
  ImportPlan,
  ProductUpsert,
} from '@/application/ports/import-job-repository'
import type { ImportJob, ImportJobSummary, ImportRowReport } from '@/domain/import/import-job'
import type { Prisma } from '@/generated/prisma/client'

const TRANSACTION_TIMEOUT_MS = 60_000

const summarySelect = {
  id: true,
  fileName: true,
  createdAt: true,
  totalRows: true,
  createdCount: true,
  updatedCount: true,
  skippedCount: true,
  failedCount: true,
} satisfies Prisma.ImportJobSelect

type SummaryRow = Prisma.ImportJobGetPayload<{ select: typeof summarySelect }>

function toSummary(row: SummaryRow): ImportJobSummary {
  return {
    id: row.id,
    fileName: row.fileName,
    createdAt: row.createdAt,
    totals: {
      rows: row.totalRows,
      created: row.createdCount,
      updated: row.updatedCount,
      skipped: row.skippedCount,
      failed: row.failedCount,
    },
  }
}

@Injectable()
export class PrismaImportJobRepository implements ImportJobRepository {
  constructor(private readonly prisma: PrismaService) {}

  commit(plan: ImportPlan): Promise<ImportJob> {
    return this.prisma.$transaction(
      async (tx) => {
        const existing = new Set(
          (
            await tx.product.findMany({
              where: { sku: { in: plan.writes.map((write) => write.sku) } },
              select: { sku: true },
            })
          ).map((row) => row.sku),
        )
        const written: ImportRowReport[] = []
        for (const write of plan.writes) {
          await this.upsertProduct(tx, write)
          written.push({
            line: write.line,
            sku: write.sku,
            name: write.name,
            outcome: existing.has(write.sku) ? 'updated' : 'created',
            issues: [],
          })
        }
        const rows = [...plan.rejected, ...written].sort((a, b) => a.line - b.line)
        const totals = countOutcomes(rows)
        const job = await tx.importJob.create({
          data: {
            fileName: plan.fileName,
            totalRows: totals.rows,
            createdCount: totals.created,
            updatedCount: totals.updated,
            skippedCount: totals.skipped,
            failedCount: totals.failed,
            rows: rows as unknown as Prisma.InputJsonArray,
          },
          select: summarySelect,
        })
        return { ...toSummary(job), rows }
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    )
  }

  async findById(id: string): Promise<ImportJob | null> {
    const row = await this.prisma.importJob.findUnique({
      where: { id },
      select: { ...summarySelect, rows: true },
    })
    return row ? { ...toSummary(row), rows: row.rows as unknown as ImportRowReport[] } : null
  }

  async findAll(): Promise<ImportJobSummary[]> {
    const rows = await this.prisma.importJob.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: summarySelect,
    })
    return rows.map(toSummary)
  }

  private async upsertProduct(tx: Prisma.TransactionClient, write: ProductUpsert): Promise<void> {
    const categoryId =
      write.category === undefined
        ? undefined
        : write.category === null
          ? null
          : (await upsertCategory(tx, write.category)).id
    const shared = {
      name: write.name,
      price: write.price,
      stock: write.stock,
      ...(write.description !== undefined && { description: write.description }),
      ...(write.weightKg !== undefined && { weightKg: write.weightKg }),
      ...(categoryId !== undefined && { categoryId }),
    }
    await tx.product.upsert({
      where: { sku: write.sku },
      create: {
        sku: write.sku,
        description: null,
        weightKg: null,
        categoryId: null,
        ...shared,
      },
      update: { ...shared, deletedAt: null },
      select: { id: true },
    })
  }
}
