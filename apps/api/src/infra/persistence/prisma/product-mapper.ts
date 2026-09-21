import type { Product } from "@/domain/product/product";
import type { Prisma } from "@/generated/prisma/client";

export const productSelect = {
  id: true,
  sku: true,
  name: true,
  description: true,
  price: true,
  stock: true,
  weightKg: true,
  category: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    price: row.price.toNumber(),
    stock: row.stock,
    weightKg: row.weightKg?.toNumber() ?? null,
    category: row.category,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
