import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestPrisma, resetDatabase } from './support/db'
import { UnavailableItemsError } from '@/domain/shared/domain-error'
import { PrismaOrderRepository } from '@/infra/persistence/prisma/prisma-order.repository'
import { PrismaProductRepository } from '@/infra/persistence/prisma/prisma-product.repository'

import type { NewProduct } from '@/application/ports/product-repository'

const newProduct = (sku: string, price: number, stock: number): NewProduct => ({
  sku,
  name: `Product ${sku}`,
  description: null,
  price,
  stock,
  weightKg: null,
  categoryId: null,
})

const customer = { name: 'Ada Lovelace', email: 'ada@example.com' }

describe('PrismaOrderRepository', () => {
  const prisma = createTestPrisma()
  const orders = new PrismaOrderRepository(prisma)
  const products = new PrismaProductRepository(prisma)

  beforeEach(() => resetDatabase(prisma))
  afterAll(() => prisma.$disconnect())

  const stockOf = async (id: string) => (await products.findById(id))!.stock

  it('reserves every line, snapshots the catalog and totals to the cent', async () => {
    const shoes = await products.create(newProduct('RS-001', 89.99, 5))
    const mouse = await products.create(newProduct('WM-042', 19.99, 10))

    const order = await orders.reserve({
      customer,
      cardLast4: '4242',
      items: [
        { productId: mouse.id, quantity: 3 },
        { productId: shoes.id, quantity: 2 },
      ],
    })

    expect(order.status).toBe('pending')
    expect(order.lines.map((line) => line.sku)).toEqual(['WM-042', 'RS-001'])
    expect(order.lines[0]).toMatchObject({ unitPrice: 19.99, quantity: 3, lineTotal: 59.97 })
    expect(order.total).toBe(239.95)
    expect(order.itemCount).toBe(5)
    expect(order.payment).toEqual({ cardLast4: '4242', reference: null, declineReason: null })
    expect(await stockOf(shoes.id)).toBe(3)
    expect(await stockOf(mouse.id)).toBe(7)
  })

  it('rolls back every decrement when one item is short', async () => {
    const shoes = await products.create(newProduct('RS-001', 89.99, 10))
    const mouse = await products.create(newProduct('WM-042', 19.99, 1))
    const deleted = await products.create(newProduct('LW-019', 10, 1))
    await products.softDelete(deleted.id)
    const missing = '019968c2-4d6e-7c2a-9d1e-0a1b2c3d4e5f'

    const attempt = orders.reserve({
      customer,
      cardLast4: '4242',
      items: [
        { productId: shoes.id, quantity: 2 },
        { productId: mouse.id, quantity: 3 },
        { productId: deleted.id, quantity: 1 },
        { productId: missing, quantity: 1 },
      ],
    })

    await expect(attempt).rejects.toBeInstanceOf(UnavailableItemsError)
    await attempt.catch((error: UnavailableItemsError) => {
      expect([...error.items].sort((a, b) => a.productId.localeCompare(b.productId))).toEqual(
        [
          { productId: mouse.id, requested: 3, available: 1, reason: 'insufficient_stock' },
          { productId: deleted.id, requested: 1, available: 0, reason: 'unavailable' },
          { productId: missing, requested: 1, available: 0, reason: 'unavailable' },
        ].sort((a, b) => a.productId.localeCompare(b.productId)),
      )
    })
    expect(await stockOf(shoes.id)).toBe(10)
    expect(await stockOf(mouse.id)).toBe(1)
    expect(await orders.findAll()).toEqual([])
  })

  it('settles as paid with the reference', async () => {
    const shoes = await products.create(newProduct('RS-001', 89.99, 5))
    const reserved = await orders.reserve({
      customer,
      cardLast4: '4242',
      items: [{ productId: shoes.id, quantity: 2 }],
    })

    const order = await orders.settle(reserved.id, { outcome: 'approved', reference: 'fake_1' })

    expect(order.status).toBe('paid')
    expect(order.payment).toEqual({ cardLast4: '4242', reference: 'fake_1', declineReason: null })
    expect(await stockOf(shoes.id)).toBe(3)
  })

  it('restores stock when settled as declined', async () => {
    const shoes = await products.create(newProduct('RS-001', 89.99, 5))
    const mouse = await products.create(newProduct('WM-042', 19.99, 10))
    const reserved = await orders.reserve({
      customer,
      cardLast4: '0002',
      items: [
        { productId: shoes.id, quantity: 2 },
        { productId: mouse.id, quantity: 4 },
      ],
    })
    expect(await stockOf(shoes.id)).toBe(3)

    const order = await orders.settle(reserved.id, {
      outcome: 'declined',
      reason: 'Your card was declined',
    })

    expect(order.status).toBe('payment_failed')
    expect(order.payment).toEqual({
      cardLast4: '0002',
      reference: null,
      declineReason: 'Your card was declined',
    })
    expect(await stockOf(shoes.id)).toBe(5)
    expect(await stockOf(mouse.id)).toBe(10)
  })

  it('never oversells under concurrent reservations', async () => {
    const shoes = await products.create(newProduct('RS-001', 89.99, 1))
    const attempt = () =>
      orders
        .reserve({ customer, cardLast4: '4242', items: [{ productId: shoes.id, quantity: 1 }] })
        .then(() => 'reserved' as const)
        .catch((error: unknown) =>
          error instanceof UnavailableItemsError ? ('rejected' as const) : Promise.reject(error),
        )

    const outcomes = await Promise.all([attempt(), attempt(), attempt()])

    expect(outcomes.filter((outcome) => outcome === 'reserved')).toHaveLength(1)
    expect(outcomes.filter((outcome) => outcome === 'rejected')).toHaveLength(2)
    expect(await stockOf(shoes.id)).toBe(0)
    expect(await orders.findAll()).toHaveLength(1)
  })

  it('lists summaries newest first with the item count', async () => {
    const shoes = await products.create(newProduct('RS-001', 89.99, 10))
    const first = await orders.reserve({
      customer,
      cardLast4: '4242',
      items: [{ productId: shoes.id, quantity: 1 }],
    })
    const second = await orders.reserve({
      customer,
      cardLast4: '4242',
      items: [{ productId: shoes.id, quantity: 3 }],
    })

    const summaries = await orders.findAll()

    expect(summaries.map((summary) => summary.id)).toEqual([second.id, first.id])
    expect(summaries[0]).toEqual({
      id: second.id,
      status: 'pending',
      customer,
      itemCount: 3,
      total: 269.97,
      createdAt: second.createdAt,
    })
    expect(await orders.findById('019968c2-4d6e-7c2a-9d1e-0a1b2c3d4e5f')).toBeNull()
  })
})
