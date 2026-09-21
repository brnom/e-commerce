import { beforeEach, describe, expect, it } from 'vitest'

import { InMemoryImportJobRepository } from './__fakes__/in-memory-import-job-repository'
import { GetImportJob } from './get-import-job'
import { ImportProducts, MAX_IMPORT_ROWS } from './import-products'
import { ListImportJobs } from './list-import-jobs'
import { InMemoryCategoryRepository } from '@/application/products/__fakes__/in-memory-category-repository'
import { InMemoryProductRepository } from '@/application/products/__fakes__/in-memory-product-repository'
import { CreateProduct } from '@/application/products/create-product'
import { DeleteProduct } from '@/application/products/delete-product'
import { GetProduct } from '@/application/products/get-product'
import { InvalidImportFileError, NotFoundError } from '@/domain/shared/domain-error'

const header = 'name,sku,description,category,price,stock,weight_kg\n'

const csv = (...lines: string[]) => ({
  fileName: 'products.csv',
  content: Buffer.from(header + lines.join('\n') + '\n'),
})

describe('ImportProducts', () => {
  let categories: InMemoryCategoryRepository
  let products: InMemoryProductRepository
  let imports: InMemoryImportJobRepository
  let importProducts: ImportProducts

  beforeEach(() => {
    categories = new InMemoryCategoryRepository()
    products = new InMemoryProductRepository(() => categories.rows)
    imports = new InMemoryImportJobRepository(products, categories)
    importProducts = new ImportProducts(imports)
  })

  it('creates, updates, skips and fails rows in one file', async () => {
    await new CreateProduct(products, categories).execute({
      sku: 'CB-010',
      name: 'Coffee',
      price: 18.75,
      stock: 500,
    })

    const job = await importProducts.execute(
      csv(
        'Running Shoes,rs-001,Lightweight,Footwear,89.99,150,0.35',
        'Coffee Beans,CB-010,"Single origin, medium roast",Food & Beverage,19.50,400,1.0',
        'Wireless Mouse,WM-042,,Electronics,$29.99,75,0.12',
        ',,,,,,',
        ',HD-099,Headphones,Electronics,149.99,30,0.25',
      ),
    )

    expect(job.totals).toEqual({ rows: 5, created: 1, updated: 1, skipped: 1, failed: 2 })
    expect(job.rows.map((row) => [row.line, row.outcome])).toEqual([
      [2, 'created'],
      [3, 'updated'],
      [4, 'failed'],
      [5, 'skipped'],
      [6, 'failed'],
    ])
    expect(job.rows[2]).toMatchObject({
      sku: 'WM-042',
      name: 'Wireless Mouse',
      issues: [{ path: 'price', message: 'Price must be a number' }],
    })
    expect(job.rows[4]).toMatchObject({
      sku: 'HD-099',
      name: null,
      issues: [{ path: 'name', message: 'Name is required' }],
    })
    expect(products.rows.map((row) => [row.sku, row.price])).toEqual([
      ['CB-010', 19.5],
      ['RS-001', 89.99],
    ])
    expect(products.rows[0]!.description).toBe('Single origin, medium roast')
    expect(categories.rows.map((category) => category.name)).toEqual([
      'Footwear',
      'Food & Beverage',
    ])
  })

  it('reports every failing field of a row', async () => {
    const job = await importProducts.execute(csv('   ,WS-001,,,5.00,-5,'))

    expect(job.rows[0]!.issues.map((issue) => issue.path)).toEqual(['name', 'stock'])
  })

  it('keeps the first occurrence of a duplicated sku and fails the later ones', async () => {
    const job = await importProducts.execute(
      csv(
        'Speaker,BS-021,,,59.99,110,0.8',
        'Hat,HT-001,,,9.99,10,',
        'Speaker,bs-021,Same sku,,49.99,200,0.75',
        'Speaker,BS-021,Again,,39.99,5,',
      ),
    )

    expect(job.totals).toEqual({ rows: 4, created: 2, updated: 0, skipped: 0, failed: 2 })
    expect(job.rows[2]!.issues).toEqual([{ path: 'sku', message: 'Duplicate of line 2' }])
    expect(job.rows[3]!.issues).toEqual([{ path: 'sku', message: 'Duplicate of line 2' }])
    expect(products.rows.find((row) => row.sku === 'BS-021')?.price).toBe(59.99)
  })

  it('restores a deleted product with a matching sku', async () => {
    const product = await new CreateProduct(products, categories).execute({
      sku: 'WM-042',
      name: 'Mouse',
      price: 29.99,
      stock: 1,
    })
    await new DeleteProduct(products).execute(product.id)

    const job = await importProducts.execute(csv('Wireless Mouse,WM-042,,,24.99,75,0.12'))

    expect(job.rows[0]!.outcome).toBe('updated')
    await expect(new GetProduct(products).execute(product.id)).resolves.toMatchObject({
      name: 'Wireless Mouse',
      price: 24.99,
    })
  })

  it('leaves fields whose column is absent untouched and clears blank cells', async () => {
    await new CreateProduct(products, categories).execute({
      sku: 'RS-001',
      name: 'Shoes',
      description: 'Old description',
      price: 1,
      stock: 1,
      weightKg: 0.5,
      category: 'Footwear',
    })

    await importProducts.execute({
      fileName: 'partial.csv',
      content: Buffer.from('sku,name,price,stock,category\nRS-001,Shoes v2,2,3,\n'),
    })

    expect(products.rows[0]).toMatchObject({
      name: 'Shoes v2',
      price: 2,
      stock: 3,
      description: 'Old description',
      weightKg: 0.5,
      categoryId: null,
    })
  })

  it('rejects a file with a missing column before writing anything', async () => {
    await expect(
      importProducts.execute({ fileName: 'x.csv', content: Buffer.from('name,sku\nA,B\n') }),
    ).rejects.toEqual(
      new InvalidImportFileError('Missing required columns: price, stock', ['price', 'stock']),
    )
    expect(imports.jobs).toHaveLength(0)
  })

  it('rejects a file with too many rows', async () => {
    const lines = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `P${i},SKU-${i},,,1,1,`)

    await expect(importProducts.execute(csv(...lines))).rejects.toThrow(InvalidImportFileError)
    expect(products.rows).toHaveLength(0)
  })

  it('lists jobs newest first without rows and fetches one by id', async () => {
    const first = await importProducts.execute(csv('A,A-1,,,1,1,'))
    const second = await importProducts.execute(csv('B,B-1,,,1,1,'))

    const list = await new ListImportJobs(imports).execute()
    expect(list.map((job) => job.id)).toEqual([second.id, first.id])
    expect(list[0]).not.toHaveProperty('rows')

    await expect(new GetImportJob(imports).execute(first.id)).resolves.toEqual(first)
    await expect(new GetImportJob(imports).execute('missing')).rejects.toThrow(NotFoundError)
  })
})
