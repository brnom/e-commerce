import type { Order, OrderLine, OrderSummary } from '@/domain/order/order'
import type { Prisma } from '@/generated/prisma/client'

export const orderSummarySelect = {
  id: true,
  status: true,
  customerName: true,
  customerEmail: true,
  total: true,
  createdAt: true,
  lines: { select: { quantity: true } },
} satisfies Prisma.OrderSelect

export const orderSelect = {
  id: true,
  status: true,
  customerName: true,
  customerEmail: true,
  total: true,
  cardLast4: true,
  paymentReference: true,
  declineReason: true,
  createdAt: true,
  updatedAt: true,
  lines: {
    select: {
      productId: true,
      sku: true,
      name: true,
      unitPrice: true,
      quantity: true,
      lineTotal: true,
    },
    orderBy: { position: 'asc' },
  },
} satisfies Prisma.OrderSelect

type SummaryRow = Prisma.OrderGetPayload<{ select: typeof orderSummarySelect }>
type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>
type LineRow = OrderRow['lines'][number]

export function toOrderSummary(row: SummaryRow): OrderSummary {
  return {
    id: row.id,
    status: row.status,
    customer: { name: row.customerName, email: row.customerEmail },
    itemCount: row.lines.reduce((sum, line) => sum + line.quantity, 0),
    total: row.total.toNumber(),
    createdAt: row.createdAt,
  }
}

function toOrderLine(row: LineRow): OrderLine {
  return {
    productId: row.productId,
    sku: row.sku,
    name: row.name,
    unitPrice: row.unitPrice.toNumber(),
    quantity: row.quantity,
    lineTotal: row.lineTotal.toNumber(),
  }
}

export function toOrder(row: OrderRow): Order {
  return {
    ...toOrderSummary(row),
    lines: row.lines.map(toOrderLine),
    payment: {
      cardLast4: row.cardLast4,
      reference: row.paymentReference,
      declineReason: row.declineReason,
    },
    updatedAt: row.updatedAt,
  }
}
