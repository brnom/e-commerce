import type { CategoryRepository } from '@/application/ports/category-repository'
import type { Category } from '@/domain/product/product'

export class ListCategories {
  constructor(private readonly categories: CategoryRepository) {}

  execute(): Promise<Category[]> {
    return this.categories.findAll()
  }
}
