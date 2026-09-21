import type { Category } from '@/domain/product/product'

export interface CategoryRepository {
  findOrCreate(name: string): Promise<Category>
  findAll(): Promise<Category[]>
}

export const CATEGORY_REPOSITORY = Symbol('CategoryRepository')
