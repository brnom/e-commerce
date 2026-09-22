import {
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
  type CreateProduct as CreateProductInput,
  type ListProductsQuery,
  type UpdateProduct as UpdateProductInput,
} from '@ecommerce/shared'
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'

import { ProductIdPipe } from './product-id.pipe'
import { ZodValidationPipe } from '../zod-validation.pipe'
import { CreateProduct } from '@/application/products/create-product'
import { DeleteProduct } from '@/application/products/delete-product'
import { GetProduct } from '@/application/products/get-product'
import { ListProducts, type ProductPage } from '@/application/products/list-products'
import { UpdateProduct } from '@/application/products/update-product'

import type { Product } from '@/domain/product/product'

@Controller('products')
export class ProductsController {
  constructor(
    private readonly createProduct: CreateProduct,
    private readonly getProduct: GetProduct,
    private readonly updateProduct: UpdateProduct,
    private readonly deleteProduct: DeleteProduct,
    private readonly listProducts: ListProducts,
  ) {}

  @Post()
  create(
    @Body({ schema: createProductSchema, pipes: [ZodValidationPipe] }) body: CreateProductInput,
  ): Promise<Product> {
    return this.createProduct.execute(body)
  }

  @Get()
  list(
    @Query({ schema: listProductsQuerySchema, pipes: [ZodValidationPipe] })
    query: ListProductsQuery,
  ): Promise<ProductPage> {
    return this.listProducts.execute(query)
  }

  @Get(':id')
  get(@Param('id', ProductIdPipe) id: string): Promise<Product> {
    return this.getProduct.execute(id)
  }

  @Patch(':id')
  update(
    @Param('id', ProductIdPipe) id: string,
    @Body({ schema: updateProductSchema, pipes: [ZodValidationPipe] }) body: UpdateProductInput,
  ): Promise<Product> {
    return this.updateProduct.execute(id, body)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ProductIdPipe) id: string): Promise<void> {
    return this.deleteProduct.execute(id)
  }
}
