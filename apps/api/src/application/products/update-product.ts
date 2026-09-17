import { normalizeCategoryName, normalizeSku } from '@/domain/product/product'
import { NotFoundError } from '@/domain/shared/domain-error'

import type { CategoryRepository } from '@/application/ports/category-repository'
import type { ProductChanges, ProductRepository } from '@/application/ports/product-repository'
import type { Product } from '@/domain/product/product'
import type { UpdateProduct as UpdateProductInput } from '@ecommerce/shared'

export class UpdateProduct {
  constructor(
    private readonly products: ProductRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(id: string, input: UpdateProductInput): Promise<Product> {
    const changes: ProductChanges = {
      ...(input.sku !== undefined && { sku: normalizeSku(input.sku) }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description ?? null }),
      ...(input.price !== undefined && { price: input.price }),
      ...(input.stock !== undefined && { stock: input.stock }),
      ...(input.weightKg !== undefined && { weightKg: input.weightKg ?? null }),
      ...(await this.categoryChange(input.category)),
    }
    const product = await this.products.update(id, changes)
    if (!product) {
      throw new NotFoundError('product', id)
    }
    return product
  }

  private async categoryChange(
    category: string | null | undefined,
  ): Promise<Pick<ProductChanges, 'categoryId'>> {
    if (category === undefined) {
      return {}
    }
    if (category === null) {
      return { categoryId: null }
    }
    const found = await this.categories.findOrCreate(normalizeCategoryName(category))
    return { categoryId: found.id }
  }
}
