import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CheckoutPage } from './checkout-page'
import { cartStore } from '@/lib/cart-store'
import { calls, renderWithQuery, stubApi } from '@/test-utils'

const push = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const shoesId = '01a0c40d-90c3-750a-af78-7d4aa60d284e'
const mouseId = '01a0c40d-90c3-750a-af78-7d4aa60d284f'
const shoes = { id: shoesId, sku: 'RS-001', name: 'Running Shoes', price: 89.99 }
const mouse = { id: mouseId, sku: 'WM-042', name: 'Wireless Mouse', price: 19.99 }
const orderId = '01a0c40d-90c3-750a-af78-7d4aa60d2900'

const order = (status: 'paid' | 'payment_failed', declineReason: string | null = null) => ({
  id: orderId,
  status,
  customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
  itemCount: 5,
  total: 239.95,
  lines: [],
  payment: { cardLast4: '4242', reference: status === 'paid' ? 'fake_1' : null, declineReason },
  createdAt: '2026-09-21T10:00:00.000Z',
  updatedAt: '2026-09-21T10:00:00.000Z',
})

async function fillForm(user: ReturnType<typeof userEvent.setup>, cardNumber: string) {
  await user.type(screen.getByLabelText('Name'), 'Ada Lovelace')
  await user.type(screen.getByLabelText('Email'), 'ada@example.com')
  await user.type(screen.getByLabelText('Cardholder name'), 'Ada Lovelace')
  await user.type(screen.getByLabelText('Card number'), cardNumber)
  await user.type(screen.getByLabelText('Expiry'), '12/99')
  await user.type(screen.getByLabelText('Security code'), '123')
}

describe('CheckoutPage', () => {
  beforeEach(() => {
    cartStore.clear()
    cartStore.add(shoes, 2)
    cartStore.add(mouse, 3)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    push.mockReset()
  })

  it('posts the cart with digit-only card number, clears the cart and opens the order', async () => {
    const fetchMock = stubApi([
      { method: 'POST', path: /\/orders$/, status: 201, body: order('paid') },
    ])
    renderWithQuery(<CheckoutPage />)
    const user = userEvent.setup()

    await fillForm(user, '4242 4242 4242 4242')
    await user.click(screen.getByRole('button', { name: 'Place order' }))

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith(`/orders/${orderId}`))
    const [, init] = calls(fetchMock, 'POST')[0]!
    expect(JSON.parse(init!.body as string)).toEqual({
      items: [
        { productId: shoesId, quantity: 2 },
        { productId: mouseId, quantity: 3 },
      ],
      customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
      card: {
        cardholderName: 'Ada Lovelace',
        cardNumber: '4242424242424242',
        expiry: '12/99',
        cvc: '123',
      },
    })
    expect(cartStore.getSnapshot()).toEqual([])
  })

  it('shows the decline reason and keeps the cart and the form', async () => {
    stubApi([
      {
        method: 'POST',
        path: /\/orders$/,
        status: 201,
        body: order('payment_failed', 'Your card was declined'),
      },
    ])
    renderWithQuery(<CheckoutPage />)
    const user = userEvent.setup()

    await fillForm(user, '4000 0000 0000 0002')
    await user.click(screen.getByRole('button', { name: 'Place order' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Payment declined: Your card was declined',
    )
    expect(
      screen.getByRole('link', { name: `order #${orderId.slice(-8).toUpperCase()}` }),
    ).toHaveAttribute('href', `/orders/${orderId}`)
    expect(cartStore.getSnapshot()).toHaveLength(2)
    expect(screen.getByLabelText('Name')).toHaveValue('Ada Lovelace')
    expect(push).not.toHaveBeenCalled()
  })

  it('adjusts the cart when the API reports unavailable items', async () => {
    stubApi([
      {
        method: 'POST',
        path: /\/orders$/,
        status: 409,
        body: {
          message: 'Some items are not available in the requested quantity',
          items: [
            { productId: shoesId, requested: 2, available: 1, reason: 'insufficient_stock' },
            { productId: mouseId, requested: 3, available: 0, reason: 'unavailable' },
          ],
        },
      },
    ])
    renderWithQuery(<CheckoutPage />)
    const user = userEvent.setup()

    await fillForm(user, '4242 4242 4242 4242')
    await user.click(screen.getByRole('button', { name: 'Place order' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Running Shoes: only 1 in stock, quantity lowered')
    expect(alert).toHaveTextContent('Wireless Mouse is no longer available and was removed')
    expect(cartStore.getSnapshot()).toEqual([
      expect.objectContaining({ productId: shoesId, quantity: 1 }),
    ])
    expect(screen.getByRole('button', { name: 'Place order' })).toBeEnabled()
  })

  it('blocks submission with field messages and sends nothing', async () => {
    const fetchMock = stubApi([])
    renderWithQuery(<CheckoutPage />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Name'), 'Ada Lovelace')
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Cardholder name'), 'Ada Lovelace')
    await user.type(screen.getByLabelText('Card number'), '1234')
    await user.type(screen.getByLabelText('Expiry'), '12/99')
    await user.type(screen.getByLabelText('Security code'), '123')
    await user.click(screen.getByRole('button', { name: 'Place order' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Card number must be 13 to 19 digits')).toBeInTheDocument()
    expect(calls(fetchMock, 'POST')).toHaveLength(0)
  })

  it('shows the empty cart state when there is nothing to buy', () => {
    cartStore.clear()
    stubApi([])
    renderWithQuery(<CheckoutPage />)

    expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Place order' })).not.toBeInTheDocument()
  })
})
