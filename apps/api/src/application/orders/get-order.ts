import { NotFoundError } from '@/domain/shared/domain-error'

import type { OrderRepository } from '@/application/ports/order-repository'
import type { Order } from '@/domain/order/order'

export class GetOrder {
  constructor(private readonly orders: OrderRepository) {}

  async execute(id: string): Promise<Order> {
    const order = await this.orders.findById(id)
    if (!order) {
      throw new NotFoundError('order', id)
    }
    return order
  }
}
