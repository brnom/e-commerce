import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestPrisma, resetDatabase } from './support/db'
import { ConflictError } from '@/domain/shared/domain-error'
import { PrismaCategoryRepository } from '@/infra/persistence/prisma/prisma-category.repository'
import { PrismaProductRepository } from '@/infra/persistence/prisma/prisma-product.repository'

import type { NewProduct, ProductSearch } from '@/application/ports/product-repository'

const base: NewProduct = {
  sku: 'RS-001',
  name: 'Running Shoes',
  description: 'Lightweight running shoes for daily training',
  price: 89.99,
  stock: 150,
  weightKg: 0.35,
  categoryId: null,
}

const defaultSearch: ProductSearch = { sort: 'createdAt', order: 'desc', page: 1, limit: 20 }

describe('PrismaProductRepository', () => {
  const prisma = createTestPrisma()
  const products = new PrismaProductRepository(prisma)
  const categories = new PrismaCategoryRepository(prisma)

  beforeEach(() => resetDatabase(prisma))
  afterAll(() => prisma.$disconnect())

  describe('create and read', () => {
    it('round-trips decimals as numbers and resolves the category', async () => {
      const footwear = await categories.findOrCreate('Footwear')

      const created = await products.create({ ...base, categoryId: footwear.id })
      const found = await products.findById(created.id)

      expect(found).toEqual(created)
      expect(created.price).toBe(89.99)
      expect(created.weightKg).toBe(0.35)
      expect(created.category).toEqual(footwear)
    })

    it('stores a null weight and description', async () => {
      const created = await products.create({ ...base, description: null, weightKg: null })

      expect(created.description).toBeNull()
      expect(created.weightKg).toBeNull()
    })

    it('rejects a duplicate sku with a ConflictError', async () => {
      await products.create(base)

      await expect(products.create({ ...base, name: 'Other' })).rejects.toEqual(
        new ConflictError('sku', 'RS-001'),
      )
      expect((await products.search(defaultSearch)).total).toBe(1)
    })
  })

  describe('update', () => {
    it("rejects taking another product's sku", async () => {
      await products.create(base)
      const other = await products.create({ ...base, sku: 'CB-010', name: 'Coffee' })

      await expect(products.update(other.id, { sku: 'RS-001' })).rejects.toBeInstanceOf(
        ConflictError,
      )
      expect((await products.findById(other.id))?.sku).toBe('CB-010')
    })

    it("accepts an update that keeps the product's own sku", async () => {
      const created = await products.create(base)

      const updated = await products.update(created.id, { sku: 'RS-001', stock: 3 })

      expect(updated?.stock).toBe(3)
    })

    it('returns null for an unknown id', async () => {
      expect(await products.update('00000000-0000-7000-8000-000000000000', { stock: 1 })).toBeNull()
    })
  })

  describe('soft delete', () => {
    it('hides the product from reads and search but keeps the sku reserved', async () => {
      const created = await products.create(base)

      expect(await products.softDelete(created.id)).toBe(true)

      expect(await products.findById(created.id)).toBeNull()
      expect((await products.search(defaultSearch)).items).toEqual([])
      expect(await products.update(created.id, { stock: 1 })).toBeNull()
      await expect(products.create(base)).rejects.toBeInstanceOf(ConflictError)
    })

    it('reports false on a second delete', async () => {
      const created = await products.create(base)
      await products.softDelete(created.id)

      expect(await products.softDelete(created.id)).toBe(false)
    })
  })

  describe('search', () => {
    it('matches name or description case-insensitively', async () => {
      await products.create(base)
      await products.create({
        ...base,
        sku: 'WM-042',
        name: 'Wireless Mouse',
        description: 'Ergonomic wireless mouse with USB receiver',
      })

      const result = await products.search({ ...defaultSearch, q: 'MOUSE' })

      expect(result.items.map((item) => item.name)).toEqual(['Wireless Mouse'])
      expect(result.total).toBe(1)
    })

    it('treats wildcard characters literally', async () => {
      await products.create({ ...base, sku: 'CT-001', name: '100% Cotton Tee' })
      await products.create({ ...base, sku: 'CS-002', name: 'Cotton Socks' })
      await products.create({ ...base, sku: 'US-003', name: 'under_score' })

      expect(
        (await products.search({ ...defaultSearch, q: '100%' })).items.map((item) => item.name),
      ).toEqual(['100% Cotton Tee'])
      expect(
        (await products.search({ ...defaultSearch, q: 'r_s' })).items.map((item) => item.name),
      ).toEqual(['under_score'])
    })

    it('combines the category filter with the text search', async () => {
      const footwear = await categories.findOrCreate('Footwear')
      const electronics = await categories.findOrCreate('Electronics')
      await products.create({ ...base, categoryId: footwear.id })
      await products.create({
        ...base,
        sku: 'HB-002',
        name: 'Hiking Boots',
        description: null,
        categoryId: footwear.id,
      })
      await products.create({
        ...base,
        sku: 'RW-003',
        name: 'Running Watch',
        categoryId: electronics.id,
      })

      const result = await products.search({
        ...defaultSearch,
        q: 'running',
        categoryId: footwear.id,
      })

      expect(result.items.map((item) => item.name)).toEqual(['Running Shoes'])
    })

    it('counts the full total beyond the requested page', async () => {
      for (let index = 0; index < 45; index += 1) {
        await products.create({ ...base, sku: `SKU-${index}`, name: `Product ${index}` })
      }

      const result = await products.search({ ...defaultSearch, page: 3, limit: 20 })

      expect(result.items).toHaveLength(5)
      expect(result.total).toBe(45)
    })

    it('sorts by price ascending', async () => {
      await products.create({ ...base, sku: 'A', price: 18.75 })
      await products.create({ ...base, sku: 'B', price: 89.99 })
      await products.create({ ...base, sku: 'C', price: 0 })

      const result = await products.search({ ...defaultSearch, sort: 'price', order: 'asc' })

      expect(result.items.map((item) => item.price)).toEqual([0, 18.75, 89.99])
    })
  })
})
