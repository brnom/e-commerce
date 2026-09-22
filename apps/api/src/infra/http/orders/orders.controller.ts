import { placeOrderSchema, type PlaceOrder as PlaceOrderInput } from '@ecommerce/shared'
import { Body, Controller, Get, Param, Post } from '@nestjs/common'

import { OrderIdPipe } from './order-id.pipe'
import { ZodValidationPipe } from '../zod-validation.pipe'
import { GetOrder } from '@/application/orders/get-order'
import { ListOrders } from '@/application/orders/list-orders'
import { PlaceOrder } from '@/application/orders/place-order'

import type { Order, OrderSummary } from '@/domain/order/order'

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly placeOrder: PlaceOrder,
    private readonly listOrders: ListOrders,
    private readonly getOrder: GetOrder,
  ) {}

  @Post()
  place(
    @Body({ schema: placeOrderSchema, pipes: [ZodValidationPipe] }) body: PlaceOrderInput,
  ): Promise<Order> {
    return this.placeOrder.execute(body)
  }

  @Get()
  list(): Promise<OrderSummary[]> {
    return this.listOrders.execute()
  }

  @Get(':id')
  get(@Param('id', OrderIdPipe) id: string): Promise<Order> {
    return this.getOrder.execute(id)
  }
}
