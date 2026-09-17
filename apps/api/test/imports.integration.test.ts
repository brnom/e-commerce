
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { resolve } from 'node:path'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestPrisma, resetDatabase } from './support/db'
import { AppModule } from '@/app.module'

const sampleFile = resolve(__dirname, '..', '..', '..', 'data', 'e-commerce_input.csv')

const header = 'name,sku,description,category,price,stock,weight_kg\n'

describe('imports HTTP contract', () => {
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
  const uploadSample = () => api().post('/imports').attach('file', sampleFile)
  const uploadText = (content: string, fileName = 'upload.csv') =>
    api().post('/imports').attach('file', Buffer.from(content), fileName)

  it('imports the sample file and reports every row', async () => {
    const response = await uploadSample()

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      fileName: 'e-commerce_input.csv',
      totals: { rows: 97, created: 87, updated: 0, skipped: 2, failed: 8 },
    })
    expect(response.body.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(response.body.rows).toHaveLength(97)

    const byOutcome = (outcome: string) =>
      response.body.rows
        .filter((row: { outcome: string }) => row.outcome === outcome)
        .map((row: { line: number }) => row.line)
    expect(byOutcome('skipped')).toEqual([62, 63])
    expect(byOutcome('failed')).toEqual([4, 7, 16, 25, 36, 41, 56, 89])

    const issuesOf = (line: number) =>
      response.body.rows.find((row: { line: number }) => row.line === line).issues
    expect(issuesOf(4)).toEqual([{ path: 'price', message: 'Price must be a number' }])
    expect(issuesOf(16)).toEqual([{ path: 'stock', message: 'Stock must be zero or more' }])
    expect(issuesOf(36)).toEqual([{ path: 'sku', message: 'Duplicate of line 2' }])
    expect(issuesOf(89)).toEqual([{ path: 'sku', message: 'Duplicate of line 11' }])

    const list = await api().get('/products?limit=100')
    expect(list.body.total).toBe(87)
    const categories = await api().get('/categories')
    expect(categories.body.map((category: { name: string }) => category.name)).toContain(
      'Food & Beverage',
    )
  })

  it('updates instead of duplicating when the same file is imported again', async () => {
    await uploadSample()

    const response = await uploadSample()

    expect(response.status).toBe(201)
    expect(response.body.totals).toEqual({
      rows: 97,
      created: 0,
      updated: 87,
      skipped: 2,
      failed: 8,
    })
    const list = await api().get('/products?limit=100')
    expect(list.body.total).toBe(87)
  })

  it('restores a deleted product whose sku is in the file', async () => {
    const created = await api()
      .post('/products')
      .send({ sku: 'WM-042', name: 'Mouse', price: 1, stock: 1 })
    await api().delete(`/products/${created.body.id}`)
    await expect(api().get(`/products/${created.body.id}`)).resolves.toMatchObject({ status: 404 })

    const response = await uploadText(`${header}Wireless Mouse,WM-042,,Electronics,29.99,75,0.12\n`)

    expect(response.body.rows[0].outcome).toBe('updated')
    const detail = await api().get(`/products/${created.body.id}`)
    expect(detail.status).toBe(200)
    expect(detail.body).toMatchObject({ name: 'Wireless Mouse', price: 29.99, stock: 75 })
  })

  it('lists jobs newest first without rows and fetches one by id', async () => {
    const first = await uploadText(`${header}A,A-1,,,1,1,\n`, 'first.csv')
    const second = await uploadText(`${header}B,B-1,,,1,1,\n`, 'second.csv')

    const list = await api().get('/imports')
    expect(list.status).toBe(200)
    expect(list.body.map((job: { fileName: string }) => job.fileName)).toEqual([
      'second.csv',
      'first.csv',
    ])
    expect(list.body[0]).not.toHaveProperty('rows')

    const detail = await api().get(`/imports/${first.body.id}`)
    expect(detail.status).toBe(200)
    expect(detail.body).toEqual(first.body)
    expect(second.body.totals.created).toBe(1)
  })

  it('responds 404 for an unknown or malformed job id', async () => {
    expect((await api().get('/imports/019972f0-0000-7000-8000-000000000000')).status).toBe(404)
    expect((await api().get('/imports/not-a-uuid')).status).toBe(404)
  })

  it('rejects a file with missing columns and records nothing', async () => {
    const response = await uploadText('name,description\nA,B\n')

    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      message: 'Missing required columns: sku, price, stock',
      missingColumns: ['sku', 'price', 'stock'],
    })
    expect((await api().get('/imports')).body).toEqual([])
  })

  it('rejects a file without data rows', async () => {
    const response = await uploadText(header)

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('The file has no data rows')
  })

  it('rejects a request without a file', async () => {
    const response = await api().post('/imports').field('name', 'x')

    expect(response.status).toBe(400)
  })

  it('rejects a file larger than 2 MB', async () => {
    const response = await uploadText(header + 'A,A-1,,,1,1,\n'.repeat(200_000))

    expect(response.status).toBe(413)
  })

  it('rejects a file with more than 5000 data rows', async () => {
    const lines = Array.from({ length: 5001 }, (_, i) => `P${i},S-${i},,,1,1,`).join('\n')

    const response = await uploadText(`${header}${lines}\n`)

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('The file has more than 5000 data rows')
  })
})
