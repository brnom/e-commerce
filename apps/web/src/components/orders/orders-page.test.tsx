import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { OrdersPage } from './orders-page'
import { renderWithQuery, stubApi } from '@/test-utils'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const paid = {
  id: '01a0c40d-90c3-750a-af78-7d4aa60d2900',
  status: 'paid',
  customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
  itemCount: 5,
  total: 239.95,
  createdAt: '2026-09-21T10:00:00.000Z',
}

const failed = {
  id: '01a0c40d-90c3-750a-af78-7d4aa60d2901',
  status: 'payment_failed',
  customer: { name: 'Grace Hopper', email: 'grace@example.com' },
  itemCount: 1,
  total: 89.99,
  createdAt: '2026-09-21T09:00:00.000Z',
}

describe('OrdersPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists orders with their code, customer, items, total and status', async () => {
    stubApi([{ path: /\/orders$/, body: [paid, failed] }])
    renderWithQuery(<OrdersPage />)

    expect(await screen.findByRole('link', { name: '#A60D2900' })).toHaveAttribute(
      'href',
      `/orders/${paid.id}`,
    )
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('$239.95')).toBeInTheDocument()
    expect(screen.getByText('paid')).toBeInTheDocument()
    expect(screen.getByText('payment failed')).toBeInTheDocument()
  })

  it('shows an empty state', async () => {
    stubApi([{ path: /\/orders$/, body: [] }])
    renderWithQuery(<OrdersPage />)

    expect(await screen.findByRole('heading', { name: 'No orders yet' })).toBeInTheDocument()
  })

  it('shows an error state with a retry action', async () => {
    stubApi([{ path: /\/orders$/, status: 500, body: { message: 'boom' } }])
    renderWithQuery(<OrdersPage />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
