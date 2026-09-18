import { Injectable } from '@nestjs/common'

import { orderSelect, orderSummarySelect, toOrder, toOrderSummary } from './order-mapper'
import { PrismaService } from './prisma.service'
import { computeTotals, lineTotal } from '@/domain/order/order'
import { UnavailableItemsError } from '@/domain/shared/domain-error'

import type {
  OrderDraft,
  OrderItemRequest,
  OrderRepository,
  Settlement,
} from '@/application/ports/order-repository'
import type { Order, OrderSummary, UnavailableItem } from '@/domain/order/order'
import type { Prisma } from '@/generated/prisma/client'

const byProductId = (a: OrderItemRequest, b: OrderItemRequest) =>
  a.productId.localeCompare(b.productId)

interface ReservedProduct {
  readonly id: string
  readonly sku: string
  readonly name: string
  readonly price: number
}

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  reserve(draft: OrderDraft): Promise<Order> {
    return this.prisma.$transaction(async (tx) => {
      const reserved = new Map<string, ReservedProduct>()
      const problems = new Map<string, UnavailableItem>()
      for (const item of [...draft.items].sort(byProductId)) {
        const product = await this.decrementStock(tx, item)
        if (product) {
          reserved.set(item.productId, product)
        } else {
          problems.set(item.productId, await this.describeProblem(tx, item))
        }
      }
      if (problems.size > 0) {
        throw new UnavailableItemsError(
          draft.items
            .map((item) => problems.get(item.productId))
            .filter((problem): problem is UnavailableItem => problem !== undefined),
        )
      }
      const lines = draft.items.map((item, position) => {
        const product = reserved.get(item.productId)!
        return {
          position,
          productId: product.id,
          sku: product.sku,
          name: product.name,
          unitPrice: product.price,
          quantity: item.quantity,
          lineTotal: lineTotal({ unitPrice: product.price, quantity: item.quantity }),
        }
      })
      const row = await tx.order.create({
        data: {
          status: 'pending',
          customerName: draft.customer.name,
          customerEmail: draft.customer.email,
          total: computeTotals(lines).total,
          cardLast4: draft.cardLast4,
          lines: { create: lines },
        },
        select: orderSelect,
      })
      return toOrder(row)
    })
  }

  settle(orderId: string, settlement: Settlement): Promise<Order> {
    return this.prisma.$transaction(async (tx) => {
      if (settlement.outcome === 'approved') {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'paid', paymentReference: settlement.reference },
        })
      } else {
        const lines = await tx.orderLine.findMany({
          where: { orderId },
          select: { productId: true, quantity: true },
          orderBy: { productId: 'asc' },
        })
        for (const line of lines) {
          await tx.product.update({
            where: { id: line.productId },
            data: { stock: { increment: line.quantity } },
          })
        }
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'payment_failed', declineReason: settlement.reason },
        })
      }
      const row = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: orderSelect })
      return toOrder(row)
    })
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({ where: { id }, select: orderSelect })
    return row ? toOrder(row) : null
  }

  async findAll(): Promise<OrderSummary[]> {
    const rows = await this.prisma.order.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: orderSummarySelect,
    })
    return rows.map(toOrderSummary)
  }

  private async decrementStock(
    tx: Prisma.TransactionClient,
    item: OrderItemRequest,
  ): Promise<ReservedProduct | null> {
    const rows = await tx.product.updateManyAndReturn({
      where: { id: item.productId, deletedAt: null, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
      select: { id: true, sku: true, name: true, price: true },
    })
    const row = rows[0]
    return row ? { ...row, price: row.price.toNumber() } : null
  }

  private async describeProblem(
    tx: Prisma.TransactionClient,
    item: OrderItemRequest,
  ): Promise<UnavailableItem> {
    const product = await tx.product.findFirst({
      where: { id: item.productId, deletedAt: null },
      select: { stock: true },
    })
    const problem = { productId: item.productId, requested: item.quantity }
    return product
      ? { ...problem, available: product.stock, reason: 'insufficient_stock' }
      : { ...problem, available: 0, reason: 'unavailable' }
  }
}
