import type { CategoryRepository } from '@/application/ports/category-repository'
import type { Category } from '@/domain/product/product'

export class InMemoryCategoryRepository implements CategoryRepository {
  readonly rows: Category[] = []

  async findOrCreate(name: string): Promise<Category> {
    const existing = this.rows.find((row) => row.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      return existing
    }
    const created = { id: `category-${this.rows.length + 1}`, name }
    this.rows.push(created)
    return created
  }

  async findAll(): Promise<Category[]> {
    return [...this.rows].sort((a, b) => a.name.localeCompare(b.name))
  }
}
