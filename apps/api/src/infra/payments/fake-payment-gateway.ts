import { Injectable } from '@nestjs/common'
import { randomBytes } from 'node:crypto'

import type {
  ChargeRequest,
  ChargeResult,
  PaymentGateway,
} from '@/application/ports/payment-gateway'

export const DECLINED_CARD = '4000000000000002'
export const INSUFFICIENT_FUNDS_CARD = '4000000000009995'

const declines: ReadonlyMap<string, string> = new Map([
  [DECLINED_CARD, 'Your card was declined'],
  [INSUFFICIENT_FUNDS_CARD, 'Your card has insufficient funds'],
])

@Injectable()
export class FakePaymentGateway implements PaymentGateway {
  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const reason = declines.get(request.card.cardNumber)
    if (reason) {
      return { outcome: 'declined', reason }
    }
    return { outcome: 'approved', reference: `fake_${randomBytes(8).toString('hex')}` }
  }
}
