import { describe, expect, it } from 'vitest'

import { DECLINED_CARD, FakePaymentGateway, INSUFFICIENT_FUNDS_CARD } from './fake-payment-gateway'

const charge = (cardNumber: string) => ({
  orderId: 'order-1',
  amount: 59.97,
  card: { cardholderName: 'Ada Lovelace', cardNumber, expiry: '12/99', cvc: '123' },
})

describe('FakePaymentGateway', () => {
  const gateway = new FakePaymentGateway()

  it('approves any other valid card with a reference', async () => {
    const result = await gateway.charge(charge('4242424242424242'))

    expect(result.outcome).toBe('approved')
    expect(result).toMatchObject({ reference: expect.stringMatching(/^fake_[0-9a-f]{16}$/) })
  })

  it('declines the generic decline card', async () => {
    await expect(gateway.charge(charge(DECLINED_CARD))).resolves.toEqual({
      outcome: 'declined',
      reason: 'Your card was declined',
    })
  })

  it('declines the insufficient funds card', async () => {
    await expect(gateway.charge(charge(INSUFFICIENT_FUNDS_CARD))).resolves.toEqual({
      outcome: 'declined',
      reason: 'Your card has insufficient funds',
    })
  })
})
