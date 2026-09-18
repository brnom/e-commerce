import type { OrderCustomer, OrderPayment, OrderStatus } from '@ecommerce/shared'

export type { OrderCustomer, OrderPayment, OrderStatus, UnavailableItem } from '@ecommerce/shared'

export interface OrderLine {
  readonly productId: string
  readonly sku: string
  readonly name: string
  readonly unitPrice: number
  readonly quantity: number
  readonly lineTotal: number
}

export interface OrderSummary {
  readonly id: string
  readonly status: OrderStatus
  readonly customer: OrderCustomer
  readonly itemCount: number
  readonly total: number
  readonly createdAt: Date
}

export interface Order extends OrderSummary {
  readonly lines: OrderLine[]
  readonly payment: OrderPayment
  readonly updatedAt: Date
}

export interface PricedItem {
  readonly unitPrice: number
  readonly quantity: number
}

const toCents = (amount: number) => Math.round(amount * 100)
const fromCents = (cents: number) => cents / 100

export function lineTotal(item: PricedItem): number {
  return fromCents(toCents(item.unitPrice) * item.quantity)
}

export function computeTotals(items: readonly PricedItem[]): {
  readonly lineTotals: number[]
  readonly total: number
  readonly itemCount: number
} {
  const cents = items.map((item) => toCents(item.unitPrice) * item.quantity)
  return {
    lineTotals: cents.map(fromCents),
    total: fromCents(cents.reduce((sum, value) => sum + value, 0)),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  }
}
