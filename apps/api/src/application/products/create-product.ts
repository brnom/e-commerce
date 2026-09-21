import { normalizeCategoryName, normalizeSku } from '@/domain/product/product'

import type { CategoryRepository } from '@/application/ports/category-repository'
import type { ProductRepository } from '@/application/ports/product-repository'
import type { Product } from '@/domain/product/product'
import type { CreateProduct as CreateProductInput } from '@ecommerce/shared'

export class CreateProduct {
  constructor(
    private readonly products: ProductRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(input: CreateProductInput): Promise<Product> {
    const category = input.category
      ? await this.categories.findOrCreate(normalizeCategoryName(input.category))
      : null
    return this.products.create({
      sku: normalizeSku(input.sku),
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      stock: input.stock,
      weightKg: input.weightKg ?? null,
      categoryId: category?.id ?? null,
    })
  }
}
