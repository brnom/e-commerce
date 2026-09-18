import type { OrderRepository } from '@/application/ports/order-repository'
import type { OrderSummary } from '@/domain/order/order'

export class ListOrders {
  constructor(private readonly orders: OrderRepository) {}

  execute(): Promise<OrderSummary[]> {
    return this.orders.findAll()
  }
}
