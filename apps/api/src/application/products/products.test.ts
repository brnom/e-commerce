import { beforeEach, describe, expect, it } from 'vitest'

import { InMemoryCategoryRepository } from './__fakes__/in-memory-category-repository'
import { InMemoryProductRepository } from './__fakes__/in-memory-product-repository'
import { CreateProduct } from './create-product'
import { DeleteProduct } from './delete-product'
import { GetProduct } from './get-product'
import { ListCategories } from './list-categories'
import { ListProducts } from './list-products'
import { UpdateProduct } from './update-product'
import { ConflictError, NotFoundError } from '@/domain/shared/domain-error'

const input = { sku: 'RS-001', name: 'Running Shoes', price: 89.99, stock: 150 }

describe('product use cases', () => {
  let categories: InMemoryCategoryRepository
  let products: InMemoryProductRepository
  let create: CreateProduct
  let update: UpdateProduct

  beforeEach(() => {
    categories = new InMemoryCategoryRepository()
    products = new InMemoryProductRepository(() => categories.rows)
    create = new CreateProduct(products, categories)
    update = new UpdateProduct(products, categories)
  })

  it('creates a product and resolves its category by name', async () => {
    const product = await create.execute({ ...input, category: 'Footwear' })

    expect(product.category).toEqual({ id: 'category-1', name: 'Footwear' })
    expect(product.description).toBeNull()
    expect(product.weightKg).toBeNull()
    expect(await new ListCategories(categories).execute()).toEqual([
      { id: 'category-1', name: 'Footwear' },
    ])
  })

  it('normalizes the sku before persisting', async () => {
    const product = await create.execute({ ...input, sku: ' rs-001 ' })

    expect(product.sku).toBe('RS-001')
  })

  it('propagates a sku conflict from the repository', async () => {
    await create.execute(input)

    await expect(create.execute({ ...input, name: 'Other' })).rejects.toBeInstanceOf(ConflictError)
  })

  it('clears the category when updated with null', async () => {
    const created = await create.execute({ ...input, category: 'Footwear' })

    const updated = await update.execute(created.id, { category: null })

    expect(updated.category).toBeNull()
  })

  it('keeps the category when the update omits it', async () => {
    const created = await create.execute({ ...input, category: 'Footwear' })

    const updated = await update.execute(created.id, { stock: 12 })

    expect(updated.stock).toBe(12)
    expect(updated.category?.name).toBe('Footwear')
    expect(updated.name).toBe('Running Shoes')
  })

  it('reuses an existing category on update regardless of case', async () => {
    await create.execute({ ...input, category: 'Electronics' })
    const created = await create.execute({ ...input, sku: 'WM-042', name: 'Mouse' })

    const updated = await update.execute(created.id, { category: 'electronics' })

    expect(updated.category?.name).toBe('Electronics')
    expect(categories.rows).toHaveLength(1)
  })

  it('throws NotFoundError when updating an unknown id', async () => {
    await expect(update.execute('missing', { stock: 1 })).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws NotFoundError when deleting an unknown id', async () => {
    await expect(new DeleteProduct(products).execute('missing')).rejects.toBeInstanceOf(
      NotFoundError,
    )
  })

  it('hides a deleted product from get and list', async () => {
    const created = await create.execute(input)

    await new DeleteProduct(products).execute(created.id)

    await expect(new GetProduct(products).execute(created.id)).rejects.toBeInstanceOf(NotFoundError)
    const page = await new ListProducts(products).execute({
      sort: 'createdAt',
      order: 'desc',
      page: 1,
      limit: 20,
    })
    expect(page).toEqual({ items: [], total: 0, page: 1, limit: 20 })
  })

  it('passes filters through to the repository and echoes the page', async () => {
    await create.execute({ ...input, category: 'Footwear' })
    await create.execute({ ...input, sku: 'WM-042', name: 'Wireless Mouse' })

    const page = await new ListProducts(products).execute({
      q: 'mouse',
      sort: 'name',
      order: 'asc',
      page: 1,
      limit: 10,
    })

    expect(page.items.map((item) => item.sku)).toEqual(['WM-042'])
    expect(page).toMatchObject({ total: 1, page: 1, limit: 10 })
  })
})
