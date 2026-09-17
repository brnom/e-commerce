import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestPrisma, resetDatabase } from './support/db'
import { PrismaCategoryRepository } from '@/infra/persistence/prisma/prisma-category.repository'
import { PrismaImportJobRepository } from '@/infra/persistence/prisma/prisma-import-job.repository'
import { PrismaProductRepository } from '@/infra/persistence/prisma/prisma-product.repository'

import type { ProductUpsert } from '@/application/ports/import-job-repository'

const shoes: ProductUpsert = {
  line: 2,
  sku: 'RS-001',
  name: 'Running Shoes',
  description: 'Lightweight',
  price: 89.99,
  stock: 150,
  weightKg: 0.35,
  category: 'Footwear',
}

describe('PrismaImportJobRepository', () => {
  const prisma = createTestPrisma()
  const imports = new PrismaImportJobRepository(prisma)
  const products = new PrismaProductRepository(prisma)
  const categories = new PrismaCategoryRepository(prisma)

  beforeEach(() => resetDatabase(prisma))
  afterAll(() => prisma.$disconnect())

  it('creates new skus, updates known ones and records the job', async () => {
    const footwear = await categories.findOrCreate('Footwear')
    const existing = await products.create({
      sku: 'CB-010',
      name: 'Coffee',
      description: null,
      price: 18.75,
      stock: 500,
      weightKg: null,
      categoryId: footwear.id,
    })

    const job = await imports.commit({
      fileName: 'products.csv',
      rejected: [
        {
          line: 3,
          sku: 'WM-042',
          name: 'Mouse',
          outcome: 'failed',
          issues: [{ path: 'price', message: 'Price must be a number' }],
        },
      ],
      writes: [
        shoes,
        {
          line: 4,
          sku: 'CB-010',
          name: 'Coffee Beans',
          price: 19.5,
          stock: 400,
          category: 'Food & Beverage',
        },
      ],
    })

    expect(job.totals).toEqual({ rows: 3, created: 1, updated: 1, skipped: 0, failed: 1 })
    expect(job.rows.map((row) => [row.line, row.outcome])).toEqual([
      [2, 'created'],
      [3, 'failed'],
      [4, 'updated'],
    ])
    const coffee = await products.findById(existing.id)
    expect(coffee).toMatchObject({ name: 'Coffee Beans', price: 19.5, stock: 400 })
    expect(coffee?.category?.name).toBe('Food & Beverage')
    expect((await categories.findAll()).map((category) => category.name)).toEqual([
      'Food & Beverage',
      'Footwear',
    ])
    await expect(imports.findById(job.id)).resolves.toEqual(job)
  })

  it('restores a deleted product and keeps fields whose column is absent', async () => {
    const created = await products.create({
      sku: 'RS-001',
      name: 'Old Shoes',
      description: 'Old description',
      price: 1,
      stock: 1,
      weightKg: 0.5,
      categoryId: null,
    })
    await products.softDelete(created.id)

    await imports.commit({
      fileName: 'restore.csv',
      rejected: [],
      writes: [{ line: 2, sku: 'RS-001', name: 'Shoes v2', price: 2, stock: 3 }],
    })

    const restored = await products.findById(created.id)
    expect(restored).toMatchObject({
      name: 'Shoes v2',
      price: 2,
      stock: 3,
      description: 'Old description',
      weightKg: 0.5,
    })
  })

  it('clears blank optional cells on update', async () => {
    const footwear = await categories.findOrCreate('Footwear')
    const created = await products.create({
      sku: 'RS-001',
      name: 'Shoes',
      description: 'Old',
      price: 1,
      stock: 1,
      weightKg: 0.5,
      categoryId: footwear.id,
    })

    await imports.commit({
      fileName: 'clear.csv',
      rejected: [],
      writes: [
        {
          line: 2,
          sku: 'RS-001',
          name: 'Shoes',
          price: 1,
          stock: 1,
          description: null,
          weightKg: null,
          category: null,
        },
      ],
    })

    expect(await products.findById(created.id)).toMatchObject({
      description: null,
      weightKg: null,
      category: null,
    })
  })

  it('writes nothing when one write fails', async () => {
    await expect(
      imports.commit({
        fileName: 'broken.csv',
        rejected: [],
        writes: [shoes, { line: 3, sku: 'HT-001', name: 'Hat', price: 1e11, stock: 1 }],
      }),
    ).rejects.toThrow()

    expect(
      (await products.search({ sort: 'createdAt', order: 'desc', page: 1, limit: 20 })).total,
    ).toBe(0)
    expect(await imports.findAll()).toEqual([])
  })

  it('lists jobs newest first without rows', async () => {
    const first = await imports.commit({ fileName: 'a.csv', rejected: [], writes: [shoes] })
    const second = await imports.commit({ fileName: 'b.csv', rejected: [], writes: [shoes] })

    const list = await imports.findAll()

    expect(list.map((job) => job.id)).toEqual([second.id, first.id])
    expect(list[0]).not.toHaveProperty('rows')
    expect(list[1]?.totals).toEqual({ rows: 1, created: 1, updated: 0, skipped: 0, failed: 0 })
    expect(list[0]?.totals.updated).toBe(1)
  })
})
