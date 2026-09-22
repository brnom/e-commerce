import { testCards } from '@ecommerce/shared'
import { Injectable } from '@nestjs/common'
import { randomBytes } from 'node:crypto'

import type {
  ChargeRequest,
  ChargeResult,
  PaymentGateway,
} from '@/application/ports/payment-gateway'

const declines: ReadonlyMap<string, string> = new Map(
  testCards.flatMap((card) =>
    card.outcome === 'declined' && card.declineReason ? [[card.number, card.declineReason]] : [],
  ),
)

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
