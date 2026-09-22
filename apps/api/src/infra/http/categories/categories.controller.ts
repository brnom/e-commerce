import { categoryResponseSchema } from '@ecommerce/shared'
import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

import { ListCategories } from '@/application/products/list-categories'

import type { Category } from '@/domain/product/product'

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly listCategories: ListCategories) {}

  @Get()
  @ApiOperation({ summary: 'List every category, ordered by name' })
  @ApiOkResponse({
    description: 'Every category',
    standardSchema: categoryResponseSchema,
    isArray: true,
  })
  list(): Promise<Category[]> {
    return this.listCategories.execute()
  }
}
