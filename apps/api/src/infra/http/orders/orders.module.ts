import { Module } from '@nestjs/common'

import { OrderIdPipe } from './order-id.pipe'
import { OrdersController } from './orders.controller'
import { ZodValidationPipe } from '../zod-validation.pipe'
import { GetOrder } from '@/application/orders/get-order'
import { ListOrders } from '@/application/orders/list-orders'
import { PlaceOrder } from '@/application/orders/place-order'
import { ORDER_REPOSITORY } from '@/application/ports/order-repository'
import { PAYMENT_GATEWAY } from '@/application/ports/payment-gateway'
import { FakePaymentGateway } from '@/infra/payments/fake-payment-gateway'
import { PrismaOrderRepository } from '@/infra/persistence/prisma/prisma-order.repository'

import type { OrderRepository } from '@/application/ports/order-repository'
import type { PaymentGateway } from '@/application/ports/payment-gateway'

@Module({
  controllers: [OrdersController],
  providers: [
    OrderIdPipe,
    ZodValidationPipe,
    { provide: ORDER_REPOSITORY, useClass: PrismaOrderRepository },
    { provide: PAYMENT_GATEWAY, useClass: FakePaymentGateway },
    {
      provide: PlaceOrder,
      useFactory: (orders: OrderRepository, payments: PaymentGateway) =>
        new PlaceOrder(orders, payments),
      inject: [ORDER_REPOSITORY, PAYMENT_GATEWAY],
    },
    {
      provide: ListOrders,
      useFactory: (orders: OrderRepository) => new ListOrders(orders),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: GetOrder,
      useFactory: (orders: OrderRepository) => new GetOrder(orders),
      inject: [ORDER_REPOSITORY],
    },
  ],
})
export class OrdersModule {}
