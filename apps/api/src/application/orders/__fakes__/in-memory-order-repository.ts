import { computeTotals, lineTotal } from '@/domain/order/order'
import { UnavailableItemsError } from '@/domain/shared/domain-error'

import type { OrderDraft, OrderRepository, Settlement } from '@/application/ports/order-repository'
import type { InMemoryProductRepository } from '@/application/products/__fakes__/in-memory-product-repository'
import type { Order, OrderLine, OrderSummary, UnavailableItem } from '@/domain/order/order'

type Row = Order & { status: Order['status']; payment: Order['payment']; updatedAt: Date }

export class InMemoryOrderRepository implements OrderRepository {
  readonly rows: Row[] = []

  constructor(private readonly products: InMemoryProductRepository) {}

  async reserve(draft: OrderDraft): Promise<Order> {
    const problems: UnavailableItem[] = []
    const lines: OrderLine[] = []
    for (const item of draft.items) {
      const product = this.products.rows.find(
        (row) => row.id === item.productId && row.deletedAt === null,
      )
      const problem = { productId: item.productId, requested: item.quantity }
      if (!product) {
        problems.push({ ...problem, available: 0, reason: 'unavailable' })
      } else if (product.stock < item.quantity) {
        problems.push({ ...problem, available: product.stock, reason: 'insufficient_stock' })
      } else {
        lines.push({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          unitPrice: product.price,
          quantity: item.quantity,
          lineTotal: lineTotal({ unitPrice: product.price, quantity: item.quantity }),
        })
      }
    }
    if (problems.length > 0) {
      throw new UnavailableItemsError(problems)
    }
    for (const line of lines) {
      this.adjustStock(line.productId, -line.quantity)
    }
    const totals = computeTotals(lines)
    const now = new Date()
    const row: Row = {
      id: `order-${this.rows.length + 1}`,
      status: 'pending',
      customer: draft.customer,
      lines,
      itemCount: totals.itemCount,
      total: totals.total,
      payment: { cardLast4: draft.cardLast4, reference: null, declineReason: null },
      createdAt: now,
      updatedAt: now,
    }
    this.rows.push(row)
    return row
  }

  async settle(orderId: string, settlement: Settlement): Promise<Order> {
    const row = this.rows.find((candidate) => candidate.id === orderId)
    if (!row) {
      throw new Error(`No pending order ${orderId}`)
    }
    if (settlement.outcome === 'approved') {
      row.status = 'paid'
      row.payment = { ...row.payment, reference: settlement.reference }
    } else {
      row.status = 'payment_failed'
      row.payment = { ...row.payment, declineReason: settlement.reason }
      for (const line of row.lines) {
        this.adjustStock(line.productId, line.quantity)
      }
    }
    row.updatedAt = new Date()
    return row
  }

  async findById(id: string): Promise<Order | null> {
    return this.rows.find((row) => row.id === id) ?? null
  }

  async findAll(): Promise<OrderSummary[]> {
    return [...this.rows]
      .reverse()
      .map(({ id, status, customer, itemCount, total, createdAt }) => ({
        id,
        status,
        customer,
        itemCount,
        total,
        createdAt,
      }))
  }

  private adjustStock(productId: string, delta: number): void {
    const product = this.products.rows.find((row) => row.id === productId)
    if (product) {
      const index = this.products.rows.indexOf(product)
      this.products.rows.splice(index, 1, { ...product, stock: product.stock + delta })
    }
  }
}
