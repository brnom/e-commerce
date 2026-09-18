import type {
  ChargeRequest,
  ChargeResult,
  PaymentGateway,
} from '@/application/ports/payment-gateway'

export class FakePaymentGateway implements PaymentGateway {
  readonly charges: ChargeRequest[] = []
  next: ChargeResult | Error = { outcome: 'approved', reference: 'fake_ref' }

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    this.charges.push(request)
    if (this.next instanceof Error) {
      throw this.next
    }
    return this.next
  }
}
