export interface Category {
  readonly id: string
  readonly name: string
}

export interface Product {
  readonly id: string
  readonly sku: string
  readonly name: string
  readonly description: string | null
  readonly price: number
  readonly stock: number
  readonly weightKg: number | null
  readonly category: Category | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export function normalizeSku(sku: string): string {
  return sku.trim().toUpperCase()
}

export function normalizeCategoryName(name: string): string {
  return name.trim()
}
