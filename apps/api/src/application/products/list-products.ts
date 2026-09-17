import type { ProductRepository } from "@/application/ports/product-repository";
import type { Product } from "@/domain/product/product";
import type { ListProductsQuery } from "@ecommerce/shared";

export interface ProductPage {
  readonly items: Product[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export class ListProducts {
  constructor(private readonly products: ProductRepository) {}

  async execute(query: ListProductsQuery): Promise<ProductPage> {
    const { items, total } = await this.products.search({
      q: query.q || undefined,
      categoryId: query.category,
      sort: query.sort,
      order: query.order,
      page: query.page,
      limit: query.limit,
    });
    return { items, total, page: query.page, limit: query.limit };
  }
}
