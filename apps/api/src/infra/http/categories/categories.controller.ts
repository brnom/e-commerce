import { Controller, Get } from "@nestjs/common";

import { ListCategories } from "@/application/products/list-categories";

import type { Category } from "@/domain/product/product";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly listCategories: ListCategories) {}

  @Get()
  list(): Promise<Category[]> {
    return this.listCategories.execute();
  }
}
