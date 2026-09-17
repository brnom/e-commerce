import { Injectable } from "@nestjs/common";

import { PrismaService } from "./prisma.service";
import { productSelect, toProduct } from "./product-mapper";
import { ConflictError } from "@/domain/shared/domain-error";
import { Prisma } from "@/generated/prisma/client";

import type {
  NewProduct,
  ProductChanges,
  ProductRepository,
  ProductSearch,
  ProductSearchResult,
} from "@/application/ports/product-repository";
import type { Product } from "@/domain/product/product";

const UNIQUE_VIOLATION = "P2002";

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: NewProduct): Promise<Product> {
    const row = await this.translatingConflicts(data.sku, () =>
      this.prisma.product.create({ data, select: productSelect }),
    );
    return toProduct(row);
  }

  async findById(id: string): Promise<Product | null> {
    const row = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: productSelect,
    });
    return row ? toProduct(row) : null;
  }

  async update(id: string, changes: ProductChanges): Promise<Product | null> {
    const rows = await this.translatingConflicts(changes.sku, () =>
      this.prisma.product.updateManyAndReturn({
        where: { id, deletedAt: null },
        data: changes,
        select: productSelect,
      }),
    );
    const row = rows[0];
    return row ? toProduct(row) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.prisma.product.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count === 1;
  }

  async search(query: ProductSearch): Promise<ProductSearchResult> {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.q && {
        OR: [
          { name: { contains: query.q, mode: "insensitive" } },
          { description: { contains: query.q, mode: "insensitive" } },
        ],
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: [{ [query.sort]: query.order }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: productSelect,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items: rows.map(toProduct), total };
  }

  private async translatingConflicts<T>(
    sku: string | undefined,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION &&
        sku !== undefined
      ) {
        throw new ConflictError("sku", sku);
      }
      throw error;
    }
  }
}
