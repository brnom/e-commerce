import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CartPage } from './cart-page'
import { cartStore } from '@/lib/cart-store'
import { renderWithQuery } from '@/test-utils'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const shoes = { id: 'p-shoes', sku: 'RS-001', name: 'Running Shoes', price: 89.99 }
const mouse = { id: 'p-mouse', sku: 'WM-042', name: 'Wireless Mouse', price: 19.99 }

describe('CartPage', () => {
  beforeEach(() => {
    cartStore.clear()
  })

  it('lists the lines with their totals and links to the checkout', () => {
    cartStore.add(shoes, 2)
    cartStore.add(mouse, 3)
    renderWithQuery(<CartPage />)

    expect(screen.getByRole('link', { name: 'Running Shoes' })).toHaveAttribute(
      'href',
      '/products/p-shoes',
    )
    expect(screen.getByText('$179.98')).toBeInTheDocument()
    expect(screen.getByText('$59.97')).toBeInTheDocument()
    expect(screen.getByText('$239.95')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', '/checkout')
  })

  it('edits a quantity and removes a line', async () => {
    cartStore.add(shoes, 2)
    cartStore.add(mouse, 1)
    renderWithQuery(<CartPage />)
    const user = userEvent.setup()

    const quantity = screen.getByLabelText('Quantity of Running Shoes')
    await user.clear(quantity)
    await user.type(quantity, '3')
    expect(screen.getByText('$269.97')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove Wireless Mouse' }))
    expect(screen.queryByRole('link', { name: 'Wireless Mouse' })).not.toBeInTheDocument()
    expect(cartStore.getSnapshot()).toEqual([
      expect.objectContaining({ productId: 'p-shoes', quantity: 3 }),
    ])
  })

  it('shows the empty state without a checkout action', () => {
    renderWithQuery(<CartPage />)

    expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse products' })).toHaveAttribute(
      'href',
      '/products',
    )
    expect(screen.queryByRole('link', { name: 'Checkout' })).not.toBeInTheDocument()
  })
})
