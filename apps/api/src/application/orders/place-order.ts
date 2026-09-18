import type { OrderRepository } from '@/application/ports/order-repository'
import type { ChargeResult, PaymentGateway } from '@/application/ports/payment-gateway'
import type { Order } from '@/domain/order/order'
import type { PaymentCard, PlaceOrder as PlaceOrderInput } from '@ecommerce/shared'

export const PROVIDER_UNAVAILABLE = 'Payment provider unavailable'

export class PlaceOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly payments: PaymentGateway,
  ) {}

  async execute(input: PlaceOrderInput): Promise<Order> {
    const reserved = await this.orders.reserve({
      customer: input.customer,
      cardLast4: input.card.cardNumber.slice(-4),
      items: input.items,
    })
    const result = await this.charge(reserved, input.card)
    return this.orders.settle(reserved.id, result)
  }

  private async charge(order: Order, card: PaymentCard): Promise<ChargeResult> {
    try {
      return await this.payments.charge({ orderId: order.id, amount: order.total, card })
    } catch {
      return { outcome: 'declined', reason: PROVIDER_UNAVAILABLE }
    }
  }
}
