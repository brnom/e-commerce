import type { PaymentCard } from '@ecommerce/shared'

export interface ChargeRequest {
  readonly orderId: string
  readonly amount: number
  readonly card: PaymentCard
}

export type ChargeResult =
  | { readonly outcome: 'approved'; readonly reference: string }
  | { readonly outcome: 'declined'; readonly reason: string }

export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<ChargeResult>
}

export const PAYMENT_GATEWAY = Symbol('PaymentGateway')
