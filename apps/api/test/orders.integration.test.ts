import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestPrisma, resetDatabase } from './support/db'
import { AppModule } from '@/app.module'

const card = {
  cardholderName: 'Ada Lovelace',
  cardNumber: '4242 4242 4242 4242',
  expiry: '12/99',
  cvc: '123',
}

const customer = { name: 'Ada Lovelace', email: 'ada@example.com' }

const missingId = '019968c2-4d6e-7c2a-9d1e-0a1b2c3d4e5f'

describe('orders HTTP contract', () => {
  let app: INestApplication
  const prisma = createTestPrisma()

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  beforeEach(() => resetDatabase(prisma))

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  const api = () => request(app.getHttpServer())

  const createProduct = async (sku: string, price: number, stock: number): Promise<string> => {
    const response = await api()
      .post('/products')
      .send({ sku, name: `Product ${sku}`, price, stock })
    expect(response.status).toBe(201)
    return response.body.id
  }

  const stockOf = async (id: string): Promise<number> =>
    (await api().get(`/products/${id}`)).body.stock

  const place = (items: Array<{ productId: string; quantity: number }>, overrides = {}) =>
    api()
      .post('/orders')
      .send({ items, customer, card, ...overrides })

  const paths = (body: { issues: Array<{ path: string }> }) =>
    body.issues.map((issue) => issue.path)

  it('places a paid order, decrementing stock and keeping only the last four digits', async () => {
    const shoes = await createProduct('RS-001', 89.99, 5)
    const mouse = await createProduct('WM-042', 19.99, 10)

    const response = await place([
      { productId: shoes, quantity: 2 },
      { productId: mouse, quantity: 3 },
    ])

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      status: 'paid',
      customer,
      itemCount: 5,
      total: 239.95,
      payment: { cardLast4: '4242', declineReason: null },
    })
    expect(response.body.payment.reference).toMatch(/^fake_/)
    expect(response.body.lines).toEqual([
      expect.objectContaining({
        productId: shoes,
        sku: 'RS-001',
        unitPrice: 89.99,
        quantity: 2,
        lineTotal: 179.98,
      }),
      expect.objectContaining({
        productId: mouse,
        sku: 'WM-042',
        unitPrice: 19.99,
        quantity: 3,
        lineTotal: 59.97,
      }),
    ])
    expect(JSON.stringify(response.body)).not.toContain('4242424242424242')
    expect(JSON.stringify(response.body)).not.toContain('12/99')
    expect(JSON.stringify(response.body)).not.toContain('"cvc"')
    expect(await stockOf(shoes)).toBe(3)
    expect(await stockOf(mouse)).toBe(7)
  })

  it.each([
    ['4000 0000 0000 0002', 'Your card was declined'],
    ['4000 0000 0000 9995', 'Your card has insufficient funds'],
  ])('records a declined payment for %s and restores the stock', async (cardNumber, reason) => {
    const shoes = await createProduct('RS-001', 89.99, 5)

    const response = await place([{ productId: shoes, quantity: 2 }], {
      card: { ...card, cardNumber },
    })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      status: 'payment_failed',
      payment: { cardLast4: cardNumber.slice(-4), reference: null, declineReason: reason },
    })
    expect(await stockOf(shoes)).toBe(5)
    const stored = await api().get(`/orders/${response.body.id}`)
    expect(stored.body.status).toBe('payment_failed')
  })

  it('rejects the whole order when one item is short', async () => {
    const shoes = await createProduct('RS-001', 89.99, 10)
    const mouse = await createProduct('WM-042', 19.99, 1)

    const response = await place([
      { productId: shoes, quantity: 2 },
      { productId: mouse, quantity: 3 },
    ])

    expect(response.status).toBe(409)
    expect(response.body).toEqual({
      message: 'Some items are not available in the requested quantity',
      items: [{ productId: mouse, requested: 3, available: 1, reason: 'insufficient_stock' }],
    })
    expect(await stockOf(shoes)).toBe(10)
    expect((await api().get('/orders')).body).toEqual([])
  })

  it('rejects deleted and unknown products as unavailable', async () => {
    const deleted = await createProduct('LW-019', 10, 1)
    await api().delete(`/products/${deleted}`)

    const response = await place([
      { productId: deleted, quantity: 1 },
      { productId: missingId, quantity: 2 },
    ])

    expect(response.status).toBe(409)
    expect(response.body.items).toEqual([
      { productId: deleted, requested: 1, available: 0, reason: 'unavailable' },
      { productId: missingId, requested: 2, available: 0, reason: 'unavailable' },
    ])
  })

  it('validates the request and reports every failing field', async () => {
    const shoes = await createProduct('RS-001', 89.99, 5)

    const luhn = await place([{ productId: shoes, quantity: 1 }], {
      card: { ...card, cardNumber: '4242 4242 4242 4241' },
    })
    expect(luhn.status).toBe(400)
    expect(paths(luhn.body)).toEqual(['card.cardNumber'])

    const expired = await place([{ productId: shoes, quantity: 1 }], {
      card: { ...card, expiry: '01/20' },
    })
    expect(paths(expired.body)).toEqual(['card.expiry'])

    const zero = await place([{ productId: shoes, quantity: 0 }])
    expect(paths(zero.body)).toEqual(['items.0.quantity'])

    const duplicate = await place([
      { productId: shoes, quantity: 1 },
      { productId: shoes, quantity: 2 },
    ])
    expect(paths(duplicate.body)).toEqual(['items'])

    const combined = await place([{ productId: shoes, quantity: 1 }], {
      customer: { name: ' ', email: 'ada@example.com' },
      card: { ...card, cvc: '12' },
    })
    expect(paths(combined.body)).toEqual(['customer.name', 'card.cvc'])

    expect(await stockOf(shoes)).toBe(5)
    expect((await api().get('/orders')).body).toEqual([])
  })

  it('keeps the purchase price after the product changes and outlives its deletion', async () => {
    const mouse = await createProduct('WM-042', 19.99, 10)
    const placed = await place([{ productId: mouse, quantity: 3 }])
    await api().patch(`/products/${mouse}`).send({ price: 25 })
    await api().delete(`/products/${mouse}`)

    const response = await api().get(`/orders/${placed.body.id}`)

    expect(response.status).toBe(200)
    expect(response.body.lines[0]).toMatchObject({
      sku: 'WM-042',
      name: 'Product WM-042',
      unitPrice: 19.99,
      lineTotal: 59.97,
    })
    expect(response.body.total).toBe(59.97)
  })

  it('lists orders newest first as summaries without lines', async () => {
    const shoes = await createProduct('RS-001', 89.99, 10)
    const first = await place([{ productId: shoes, quantity: 1 }])
    const second = await place([{ productId: shoes, quantity: 2 }])

    const response = await api().get('/orders')

    expect(response.status).toBe(200)
    expect(response.body.map((order: { id: string }) => order.id)).toEqual([
      second.body.id,
      first.body.id,
    ])
    expect(response.body[0]).toEqual({
      id: second.body.id,
      status: 'paid',
      customer,
      itemCount: 2,
      total: 179.98,
      createdAt: second.body.createdAt,
    })
  })

  it('responds 404 for an unknown or malformed order id', async () => {
    expect((await api().get(`/orders/${missingId}`)).status).toBe(404)
    expect((await api().get('/orders/not-a-uuid')).status).toBe(404)
  })
})
