import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestPrisma, resetDatabase } from './support/db'
import { AppModule } from '@/app.module'

const valid = {
  sku: 'rs-001',
  name: 'Running Shoes',
  description: 'Lightweight running shoes',
  price: 89.99,
  stock: 150,
  weightKg: 0.35,
  category: 'Footwear',
}

describe('products HTTP contract', () => {
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
  const create = (body: object = valid) => api().post('/products').send(body)

  it('creates a product with a generated id and a normalized sku', async () => {
    const response = await create()

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      sku: 'RS-001',
      name: 'Running Shoes',
      description: 'Lightweight running shoes',
      price: 89.99,
      stock: 150,
      weightKg: 0.35,
      category: { name: 'Footwear' },
    })
    expect(response.body.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(typeof response.body.createdAt).toBe('string')
  })

  it('reports every invalid field together with 400', async () => {
    const response = await create({ ...valid, name: '   ', price: '$29.99', stock: -5 })

    expect(response.status).toBe(400)
    expect(response.body.issues.map((issue: { path: string }) => issue.path)).toEqual([
      'name',
      'price',
      'stock',
    ])
  })

  it('accepts a zero price without a weight', async () => {
    const response = await create({ sku: 'MB-001', name: 'Mystery Box', price: 0, stock: 1 })

    expect(response.status).toBe(201)
    expect(response.body.price).toBe(0)
    expect(response.body.weightKg).toBeNull()
    expect(response.body.category).toBeNull()
  })

  it('answers 409 naming the sku on a duplicate', async () => {
    await create()

    const response = await create({ ...valid, sku: 'RS-001', name: 'Other' })

    expect(response.status).toBe(409)
    expect(response.body).toEqual({
      message: 'sku "RS-001" is already taken',
      field: 'sku',
      value: 'RS-001',
    })
    expect((await api().get('/products')).body.total).toBe(1)
  })

  it('reuses an existing category regardless of case', async () => {
    await create()
    await create({ ...valid, sku: 'HB-002', category: ' footwear ' })

    const categories = await api().get('/categories')

    expect(categories.status).toBe(200)
    expect(categories.body).toEqual([{ id: expect.any(String), name: 'Footwear' }])
  })

  it('updates partially and leaves the other fields intact', async () => {
    const { body: created } = await create()

    const response = await api().patch(`/products/${created.id}`).send({ stock: 12 })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ ...created, stock: 12, updatedAt: expect.any(String) })
  })

  it('clears the category with null', async () => {
    const { body: created } = await create()

    const response = await api().patch(`/products/${created.id}`).send({ category: null })

    expect(response.body.category).toBeNull()
  })

  it('answers 404 for an unknown or malformed id', async () => {
    expect((await api().get('/products/01a0c40d-90c3-750a-af78-7d4aa60d284e')).status).toBe(404)
    expect((await api().get('/products/not-a-uuid')).status).toBe(404)
    expect((await api().patch('/products/not-a-uuid').send({ stock: 1 })).status).toBe(404)
  })

  it('soft-deletes: 204, then 404 on read, update and a second delete, sku stays reserved', async () => {
    const { body: created } = await create()

    expect((await api().delete(`/products/${created.id}`)).status).toBe(204)

    expect((await api().get(`/products/${created.id}`)).status).toBe(404)
    expect((await api().patch(`/products/${created.id}`).send({ stock: 1 })).status).toBe(404)
    expect((await api().delete(`/products/${created.id}`)).status).toBe(404)
    expect((await api().get('/products')).body.items).toEqual([])
    expect((await create()).status).toBe(409)
  })

  it('lists with the page shape and applies q, sort and pagination', async () => {
    await create()
    await create({ ...valid, sku: 'WM-042', name: 'Wireless Mouse', price: 29.99 })
    await create({ ...valid, sku: 'CB-010', name: 'Coffee Beans', price: 18.75 })

    const page = await api().get('/products?sort=price&order=asc&limit=2')
    const search = await api().get('/products?q=MOUSE')

    expect(page.status).toBe(200)
    expect(page.body).toMatchObject({ total: 3, page: 1, limit: 2 })
    expect(page.body.items.map((item: { price: number }) => item.price)).toEqual([18.75, 29.99])
    expect(search.body.items.map((item: { sku: string }) => item.sku)).toEqual(['WM-042'])
  })

  it('rejects an invalid query with 400', async () => {
    const response = await api().get('/products?limit=500')

    expect(response.status).toBe(400)
    expect(response.body.issues[0].path).toBe('limit')
  })
})
