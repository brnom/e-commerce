import { ConflictError } from '@/domain/shared/domain-error'

import type {
  NewProduct,
  ProductChanges,
  ProductRepository,
  ProductSearch,
  ProductSearchResult,
} from '@/application/ports/product-repository'
import type { Category, Product } from '@/domain/product/product'

type Row = Omit<Product, 'category'> & { categoryId: string | null; deletedAt: Date | null }

export class InMemoryProductRepository implements ProductRepository {
  readonly rows: Row[] = []

  constructor(private readonly categories: () => Category[]) {}

  async create(data: NewProduct): Promise<Product> {
    this.assertSkuFree(data.sku)
    const now = new Date()
    const row: Row = {
      id: `product-${this.rows.length + 1}`,
      ...data,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    this.rows.push(row)
    return this.toProduct(row)
  }

  async findById(id: string): Promise<Product | null> {
    const row = this.active().find((candidate) => candidate.id === id)
    return row ? this.toProduct(row) : null
  }

  async update(id: string, changes: ProductChanges): Promise<Product | null> {
    const row = this.active().find((candidate) => candidate.id === id)
    if (!row) {
      return null
    }
    if (changes.sku !== undefined && changes.sku !== row.sku) {
      this.assertSkuFree(changes.sku)
    }
    Object.assign(row, changes, { updatedAt: new Date() })
    return this.toProduct(row)
  }

  async softDelete(id: string): Promise<boolean> {
    const row = this.active().find((candidate) => candidate.id === id)
    if (!row) {
      return false
    }
    row.deletedAt = new Date()
    return true
  }

  async search(query: ProductSearch): Promise<ProductSearchResult> {
    const needle = query.q?.toLowerCase()
    const matches = this.active().filter(
      (row) =>
        (!needle ||
          row.name.toLowerCase().includes(needle) ||
          row.description?.toLowerCase().includes(needle)) &&
        (!query.categoryId || row.categoryId === query.categoryId),
    )
    const start = (query.page - 1) * query.limit
    return {
      items: matches.slice(start, start + query.limit).map((row) => this.toProduct(row)),
      total: matches.length,
    }
  }

  private active(): Row[] {
    return this.rows.filter((row) => row.deletedAt === null)
  }

  private assertSkuFree(sku: string): void {
    if (this.rows.some((row) => row.sku === sku)) {
      throw new ConflictError('sku', sku)
    }
  }

  private toProduct(row: Row): Product {
    const category = this.categories().find((candidate) => candidate.id === row.categoryId) ?? null
    return {
      id: row.id,
      sku: row.sku,
      name: row.name,
      description: row.description,
      price: row.price,
      stock: row.stock,
      weightKg: row.weightKg,
      category,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}
