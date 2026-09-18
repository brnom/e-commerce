import type { Order, OrderCustomer, OrderSummary } from '@/domain/order/order'

export interface OrderItemRequest {
  readonly productId: string
  readonly quantity: number
}

export interface OrderDraft {
  readonly customer: OrderCustomer
  readonly cardLast4: string
  readonly items: readonly OrderItemRequest[]
}

export type Settlement =
  | { readonly outcome: 'approved'; readonly reference: string }
  | { readonly outcome: 'declined'; readonly reason: string }

export interface OrderRepository {
  reserve(draft: OrderDraft): Promise<Order>
  settle(orderId: string, settlement: Settlement): Promise<Order>
  findById(id: string): Promise<Order | null>
  findAll(): Promise<OrderSummary[]>
}

export const ORDER_REPOSITORY = Symbol('OrderRepository')
