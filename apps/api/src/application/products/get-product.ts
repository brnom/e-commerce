import { NotFoundError } from "@/domain/shared/domain-error";

import type { ProductRepository } from "@/application/ports/product-repository";
import type { Product } from "@/domain/product/product";

export class GetProduct {
  constructor(private readonly products: ProductRepository) {}

  async execute(id: string): Promise<Product> {
    const product = await this.products.findById(id);
    if (!product) {
      throw new NotFoundError("product", id);
    }
    return product;
  }
}
