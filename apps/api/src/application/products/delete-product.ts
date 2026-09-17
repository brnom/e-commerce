import { NotFoundError } from "@/domain/shared/domain-error";

import type { ProductRepository } from "@/application/ports/product-repository";

export class DeleteProduct {
  constructor(private readonly products: ProductRepository) {}

  async execute(id: string): Promise<void> {
    const deleted = await this.products.softDelete(id);
    if (!deleted) {
      throw new NotFoundError("product", id);
    }
  }
}
