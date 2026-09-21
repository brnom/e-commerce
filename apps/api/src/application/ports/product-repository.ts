import type { Product } from "@/domain/product/product";
import type { ProductSortField } from "@ecommerce/shared";

export interface NewProduct {
  readonly sku: string;
  readonly name: string;
  readonly description: string | null;
  readonly price: number;
  readonly stock: number;
  readonly weightKg: number | null;
  readonly categoryId: string | null;
}

export type ProductChanges = Partial<NewProduct>;

export interface ProductSearch {
  readonly q?: string;
  readonly categoryId?: string;
  readonly sort: ProductSortField;
  readonly order: "asc" | "desc";
  readonly page: number;
  readonly limit: number;
}

export interface ProductSearchResult {
  readonly items: Product[];
  readonly total: number;
}

export interface ProductRepository {
  create(data: NewProduct): Promise<Product>;
  findById(id: string): Promise<Product | null>;
  update(id: string, changes: ProductChanges): Promise<Product | null>;
  softDelete(id: string): Promise<boolean>;
  search(query: ProductSearch): Promise<ProductSearchResult>;
}

export const PRODUCT_REPOSITORY = Symbol("ProductRepository");
