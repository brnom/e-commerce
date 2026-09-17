import type { Category } from '@/domain/product/product'
import type { Prisma } from '@/generated/prisma/client'

export function upsertCategory(tx: Prisma.TransactionClient, name: string): Promise<Category> {
  return tx.category.upsert({
    where: { name },
    create: { name },
    update: {},
    select: { id: true, name: true },
  })
}
