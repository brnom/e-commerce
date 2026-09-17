import { Injectable } from '@nestjs/common'

import { upsertCategory } from './category-upsert'
import { PrismaService } from './prisma.service'

import type { CategoryRepository } from '@/application/ports/category-repository'
import type { Category } from '@/domain/product/product'

@Injectable()
export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOrCreate(name: string): Promise<Category> {
    return upsertCategory(this.prisma, name)
  }

  findAll(): Promise<Category[]> {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
  }
}
