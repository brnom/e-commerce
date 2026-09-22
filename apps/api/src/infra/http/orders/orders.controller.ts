import {
  orderResponseSchema,
  orderSummarySchema,
  placeOrderSchema,
  type PlaceOrder as PlaceOrderInput,
} from '@ecommerce/shared'
import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'

import { OrderIdPipe } from './order-id.pipe'
import {
  ApiResourceNotFound,
  ApiUnavailableItems,
  ApiValidationFailure,
} from '../openapi/api-responses'
import { ZodValidationPipe } from '../zod-validation.pipe'
import { GetOrder } from '@/application/orders/get-order'
import { ListOrders } from '@/application/orders/list-orders'
import { PlaceOrder } from '@/application/orders/place-order'

import type { Order, OrderSummary } from '@/domain/order/order'

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly placeOrder: PlaceOrder,
    private readonly listOrders: ListOrders,
    private readonly getOrder: GetOrder,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Place an order, reserving stock and charging the card' })
  @ApiCreatedResponse({
    description: 'The order, paid or with the decline reason',
    standardSchema: orderResponseSchema,
  })
  @ApiValidationFailure()
  @ApiUnavailableItems()
  place(
    @Body({ schema: placeOrderSchema, pipes: [ZodValidationPipe] }) body: PlaceOrderInput,
  ): Promise<Order> {
    return this.placeOrder.execute(body)
  }

  @Get()
  @ApiOperation({ summary: 'List order summaries, newest first' })
  @ApiOkResponse({
    description: 'Every order summary',
    standardSchema: orderSummarySchema,
    isArray: true,
  })
  list(): Promise<OrderSummary[]> {
    return this.listOrders.execute()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one order with its lines, total and payment' })
  @ApiParam({ name: 'id', description: 'The order id, a uuid v7', format: 'uuid' })
  @ApiOkResponse({ description: 'The order', standardSchema: orderResponseSchema })
  @ApiResourceNotFound('order')
  get(@Param('id', OrderIdPipe) id: string): Promise<Order> {
    return this.getOrder.execute(id)
  }
}
