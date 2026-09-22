import {
  createProductSchema,
  listProductsQuerySchema,
  productPageSchema,
  productResponseSchema,
  updateProductSchema,
  type CreateProduct as CreateProductInput,
  type ListProductsQuery,
  type UpdateProduct as UpdateProductInput,
} from '@ecommerce/shared'
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'

import { ProductIdPipe } from './product-id.pipe'
import { ApiResourceNotFound, ApiSkuConflict, ApiValidationFailure } from '../openapi/api-responses'
import { ZodValidationPipe } from '../zod-validation.pipe'
import { CreateProduct } from '@/application/products/create-product'
import { DeleteProduct } from '@/application/products/delete-product'
import { GetProduct } from '@/application/products/get-product'
import { ListProducts, type ProductPage } from '@/application/products/list-products'
import { UpdateProduct } from '@/application/products/update-product'

import type { Product } from '@/domain/product/product'

@ApiTags('Products')
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
  @ApiOperation({ summary: 'Create a product' })
  @ApiCreatedResponse({ description: 'The created product', standardSchema: productResponseSchema })
  @ApiValidationFailure()
  @ApiSkuConflict()
  create(
    @Body({ schema: createProductSchema, pipes: [ZodValidationPipe] }) body: CreateProductInput,
  ): Promise<Product> {
    return this.createProduct.execute(body)
  }

  @Get()
  @ApiOperation({ summary: 'List products, filtered, sorted and paginated' })
  @ApiOkResponse({ description: 'One page of products', standardSchema: productPageSchema })
  @ApiValidationFailure()
  list(
    @Query({ schema: listProductsQuerySchema, pipes: [ZodValidationPipe] })
    query: ListProductsQuery,
  ): Promise<ProductPage> {
    return this.listProducts.execute(query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one product' })
  @ApiParam({ name: 'id', description: 'The product id, a uuid v7', format: 'uuid' })
  @ApiOkResponse({ description: 'The product', standardSchema: productResponseSchema })
  @ApiResourceNotFound('product')
  get(@Param('id', ProductIdPipe) id: string): Promise<Product> {
    return this.getProduct.execute(id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update part of a product' })
  @ApiParam({ name: 'id', description: 'The product id, a uuid v7', format: 'uuid' })
  @ApiOkResponse({ description: 'The updated product', standardSchema: productResponseSchema })
  @ApiValidationFailure()
  @ApiResourceNotFound('product')
  @ApiSkuConflict()
  update(
    @Param('id', ProductIdPipe) id: string,
    @Body({ schema: updateProductSchema, pipes: [ZodValidationPipe] }) body: UpdateProductInput,
  ): Promise<Product> {
    return this.updateProduct.execute(id, body)
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft delete a product' })
  @ApiParam({ name: 'id', description: 'The product id, a uuid v7', format: 'uuid' })
  @ApiNoContentResponse({ description: 'The product was deleted' })
  @ApiResourceNotFound('product')
  remove(@Param('id', ProductIdPipe) id: string): Promise<void> {
    return this.deleteProduct.execute(id)
  }
}
