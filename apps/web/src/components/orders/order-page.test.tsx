import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { OrderPage } from './order-page'
import { renderWithQuery, stubApi } from '@/test-utils'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const id = '01a0c40d-90c3-750a-af78-7d4aa60d2900'
const order = {
  id,
  status: 'paid',
  customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
  itemCount: 5,
  total: 239.95,
  lines: [
    {
      productId: '01a0c40d-90c3-750a-af78-7d4aa60d284e',
      sku: 'RS-001',
      name: 'Running Shoes',
      unitPrice: 89.99,
      quantity: 2,
      lineTotal: 179.98,
    },
    {
      productId: '01a0c40d-90c3-750a-af78-7d4aa60d284f',
      sku: 'WM-042',
      name: 'Wireless Mouse',
      unitPrice: 19.99,
      quantity: 3,
      lineTotal: 59.97,
    },
  ],
  payment: { cardLast4: '4242', reference: 'fake_abc123', declineReason: null },
  createdAt: '2026-09-21T10:00:00.000Z',
  updatedAt: '2026-09-21T10:00:00.000Z',
}

describe('OrderPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows a paid order with its customer, card, lines and total', async () => {
    stubApi([{ path: new RegExp(`/orders/${id}$`), body: order }])
    renderWithQuery(<OrderPage orderId={id} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Order #A60D2900' })).toBeVisible()
    expect(screen.getByText('paid')).toBeInTheDocument()
    const sheet = screen.getByText('Customer').closest('dl')!
    expect(within(sheet).getByText('Ada Lovelace')).toBeInTheDocument()
    expect(within(sheet).getByText('ada@example.com')).toBeInTheDocument()
    expect(within(sheet).getByText('•••• 4242')).toBeInTheDocument()
    expect(within(sheet).getByText('fake_abc123')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Running Shoes' })).toHaveAttribute(
      'href',
      '/products/01a0c40d-90c3-750a-af78-7d4aa60d284e',
    )
    expect(screen.getByText('$179.98')).toBeInTheDocument()
    expect(screen.getByText('$59.97')).toBeInTheDocument()
    expect(screen.getByText('$239.95')).toBeInTheDocument()
  })

  it('shows the decline reason of a failed order', async () => {
    stubApi([
      {
        path: new RegExp(`/orders/${id}$`),
        body: {
          ...order,
          status: 'payment_failed',
          payment: { cardLast4: '0002', reference: null, declineReason: 'Your card was declined' },
        },
      },
    ])
    renderWithQuery(<OrderPage orderId={id} />)

    expect(await screen.findByText('payment failed')).toBeInTheDocument()
    expect(screen.getByText('Decline reason')).toBeInTheDocument()
    expect(screen.getByText('Your card was declined')).toBeInTheDocument()
  })

  it('shows a not-found state for a 404', async () => {
    stubApi([{ path: /\/orders\//, status: 404, body: { message: 'No order' } }])
    renderWithQuery(<OrderPage orderId={id} />)

    expect(await screen.findByRole('heading', { name: 'Order not found' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to orders' })).toHaveAttribute('href', '/orders')
  })
})
