import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AppModule } from '@/app.module'
import { OPENAPI_JSON_PATH, OPENAPI_PATH, setupOpenApi } from '@/infra/http/openapi/openapi'
import { SCHEMA_COMPONENT_IDS } from '@/infra/http/openapi/schema-components'
import { PrismaService } from '@/infra/persistence/prisma/prisma.service'

import type { OpenAPIObject } from '@nestjs/swagger'

describe('OpenAPI document', () => {
  let app: INestApplication
  let document: OpenAPIObject

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ onModuleInit: async () => undefined, onModuleDestroy: async () => undefined })
      .compile()
    app = moduleRef.createNestApplication()
    setupOpenApi(app)
    await app.init()
    const response = await request(app.getHttpServer()).get(`/${OPENAPI_JSON_PATH}`)
    document = response.body as OpenAPIObject
  })

  afterAll(async () => {
    await app.close()
  })

  it('serves the Swagger UI', async () => {
    const response = await request(app.getHttpServer()).get(`/${OPENAPI_PATH}`)

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.text).toContain('swagger-ui')
  })

  it('documents every route', () => {
    expect(Object.keys(document.paths).sort()).toEqual([
      '/categories',
      '/health',
      '/imports',
      '/imports/{id}',
      '/orders',
      '/orders/{id}',
      '/products',
      '/products/{id}',
    ])
  })

  it('takes request bodies from the shared zod schemas', () => {
    const body = document.paths['/products']?.post?.requestBody

    expect(body).toMatchObject({
      content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateProduct' } } },
    })
    expect(document.components?.schemas?.['CreateProduct']).toMatchObject({
      required: ['sku', 'name', 'price', 'stock'],
    })
  })

  it('expands the product list query into parameters', () => {
    const parameters = document.paths['/products']?.get?.parameters ?? []

    expect(parameters.map((parameter) => ('name' in parameter ? parameter.name : ''))).toEqual([
      'q',
      'category',
      'sort',
      'order',
      'page',
      'limit',
    ])
    expect(parameters.every((parameter) => 'in' in parameter && parameter.in === 'query')).toBe(
      true,
    )
  })

  it('documents responses with the shared zod schemas', () => {
    expect(document.paths['/products']?.get?.responses['200']).toMatchObject({
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductPage' } } },
    })
    expect(document.paths['/orders']?.get?.responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { type: 'array', items: { $ref: '#/components/schemas/OrderSummary' } },
        },
      },
    })
  })

  it('documents the error bodies the filter answers with', () => {
    expect(document.paths['/products']?.post?.responses['400']).toMatchObject({
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } },
    })
    expect(document.paths['/products']?.post?.responses['409']).toMatchObject({
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ConflictError' } } },
    })
    expect(document.paths['/orders']?.post?.responses['409']).toMatchObject({
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/UnavailableItemsError' } },
      },
    })
    expect(document.paths['/products/{id}']?.get?.responses['404']).toMatchObject({
      content: { 'application/json': { schema: { $ref: '#/components/schemas/NotFoundError' } } },
    })
    expect(document.paths['/imports']?.post?.responses['400']).toMatchObject({
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/InvalidImportFileError' } },
      },
    })
    expect(document.paths['/imports']?.post?.responses['413']).toMatchObject({
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/UploadTooLargeError' } },
      },
    })
  })

  it('documents the CSV upload as multipart with a binary file field', () => {
    const upload = document.paths['/imports']?.post

    expect(upload?.requestBody).toMatchObject({
      required: true,
      content: {
        'multipart/form-data': {
          schema: { properties: { file: { type: 'string', format: 'binary' } } },
        },
      },
    })
  })

  it('gives every registered schema its own named component', () => {
    const named = Object.keys(document.components?.schemas ?? {})

    expect(named).toEqual(expect.arrayContaining(SCHEMA_COMPONENT_IDS))
  })

  it('names every schema it references', () => {
    const named = new Set(Object.keys(document.components?.schemas ?? {}))
    const references = JSON.stringify(document).match(/#\/components\/schemas\/[A-Za-z]+/g) ?? []

    expect(references.length).toBeGreaterThan(0)
    for (const reference of references) {
      expect(named).toContain(reference.replace('#/components/schemas/', ''))
    }
  })
})
