import { Module } from "@nestjs/common";

import { ProductIdPipe } from "./product-id.pipe";
import { ProductsController } from "./products.controller";
import { CategoriesController } from "../categories/categories.controller";
import { CATEGORY_REPOSITORY } from "@/application/ports/category-repository";
import { PRODUCT_REPOSITORY } from "@/application/ports/product-repository";
import { CreateProduct } from "@/application/products/create-product";
import { DeleteProduct } from "@/application/products/delete-product";
import { GetProduct } from "@/application/products/get-product";
import { ListCategories } from "@/application/products/list-categories";
import { ListProducts } from "@/application/products/list-products";
import { UpdateProduct } from "@/application/products/update-product";
import { PrismaCategoryRepository } from "@/infra/persistence/prisma/prisma-category.repository";
import { PrismaProductRepository } from "@/infra/persistence/prisma/prisma-product.repository";

import type { CategoryRepository } from "@/application/ports/category-repository";
import type { ProductRepository } from "@/application/ports/product-repository";

@Module({
  controllers: [ProductsController, CategoriesController],
  providers: [
    ProductIdPipe,
    { provide: PRODUCT_REPOSITORY, useClass: PrismaProductRepository },
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
    {
      provide: CreateProduct,
      useFactory: (products: ProductRepository, categories: CategoryRepository) =>
        new CreateProduct(products, categories),
      inject: [PRODUCT_REPOSITORY, CATEGORY_REPOSITORY],
    },
    {
      provide: GetProduct,
      useFactory: (products: ProductRepository) => new GetProduct(products),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: UpdateProduct,
      useFactory: (products: ProductRepository, categories: CategoryRepository) =>
        new UpdateProduct(products, categories),
      inject: [PRODUCT_REPOSITORY, CATEGORY_REPOSITORY],
    },
    {
      provide: DeleteProduct,
      useFactory: (products: ProductRepository) => new DeleteProduct(products),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: ListProducts,
      useFactory: (products: ProductRepository) => new ListProducts(products),
      inject: [PRODUCT_REPOSITORY],
    },
    {
      provide: ListCategories,
      useFactory: (categories: CategoryRepository) => new ListCategories(categories),
      inject: [CATEGORY_REPOSITORY],
    },
  ],
})
export class ProductsModule {}
