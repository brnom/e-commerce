import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

import { registerSchemaComponents } from './schema-components'

import type { INestApplication } from '@nestjs/common'
import type { OpenAPIObject } from '@nestjs/swagger'

export const OPENAPI_PATH = 'docs'
export const OPENAPI_JSON_PATH = `${OPENAPI_PATH}/json`

const DESCRIPTION = [
  'Product catalog, CSV import and checkout.',
  'Every endpoint is JSON over HTTP and unauthenticated.',
  'Validation failures answer 400 with one issue per failing field,',
  'an unknown id answers 404 and a conflict answers 409.',
].join(' ')

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  registerSchemaComponents()
  const config = new DocumentBuilder()
    .setTitle('E-commerce API')
    .setDescription(DESCRIPTION)
    .setVersion('1.0.0')
    .addTag('Health', 'Liveness plus a database check')
    .addTag('Products', 'Catalog CRUD, search, sorting and pagination')
    .addTag('Categories', 'Categories created on demand by products and imports')
    .addTag('Imports', 'CSV upload and the per-row report of each job')
    .addTag('Orders', 'Checkout with stock reservation and a fake payment gateway')
    .build()
  return SwaggerModule.createDocument(app, config)
}

export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup(OPENAPI_PATH, app, createOpenApiDocument(app), {
    jsonDocumentUrl: OPENAPI_JSON_PATH,
    customSiteTitle: 'E-commerce API',
    swaggerOptions: { displayRequestDuration: true, docExpansion: 'list' },
  })
}
