import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestPrisma, resetDatabase } from './support/db'
import { PrismaCategoryRepository } from '@/infra/persistence/prisma/prisma-category.repository'

describe('PrismaCategoryRepository', () => {
  const prisma = createTestPrisma()
  const repository = new PrismaCategoryRepository(prisma)

  beforeEach(() => resetDatabase(prisma))
  afterAll(() => prisma.$disconnect())

  it('creates a category the first time a name is seen', async () => {
    const category = await repository.findOrCreate('Footwear')

    expect(category.name).toBe('Footwear')
    expect(await repository.findAll()).toEqual([category])
  })

  it('reuses an existing category regardless of case and keeps the original spelling', async () => {
    const first = await repository.findOrCreate('Electronics')

    const second = await repository.findOrCreate('electronics')

    expect(second).toEqual(first)
    expect(await repository.findAll()).toEqual([{ id: first.id, name: 'Electronics' }])
  })

  it('lists categories ordered by name', async () => {
    await repository.findOrCreate('Toys')
    await repository.findOrCreate('Accessories')
    await repository.findOrCreate('Food & Beverage')

    expect((await repository.findAll()).map((category) => category.name)).toEqual([
      'Accessories',
      'Food & Beverage',
      'Toys',
    ])
  })
})
