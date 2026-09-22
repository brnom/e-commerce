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

  it('edits a quantity with the stepper', async () => {
    cartStore.add(shoes, 2)
    cartStore.add(mouse, 1)
    renderWithQuery(<CartPage />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Increase quantity of Running Shoes' }))
    expect(screen.getByLabelText('Quantity of Running Shoes')).toHaveValue(3)
    expect(screen.getByText('$269.97')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Decrease quantity of Wireless Mouse' }),
    ).toBeDisabled()
    expect(cartStore.getSnapshot()).toEqual([
      expect.objectContaining({ productId: 'p-shoes', quantity: 3 }),
      expect.objectContaining({ productId: 'p-mouse', quantity: 1 }),
    ])
  })

  it('removes a line only after confirmation', async () => {
    cartStore.add(shoes, 2)
    cartStore.add(mouse, 1)
    renderWithQuery(<CartPage />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Remove Wireless Mouse' }))
    expect(await screen.findByRole('alertdialog', { name: 'Remove from cart?' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('link', { name: 'Wireless Mouse' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove Wireless Mouse' }))
    await user.click(await screen.findByRole('button', { name: 'Remove' }))
    expect(screen.queryByRole('link', { name: 'Wireless Mouse' })).not.toBeInTheDocument()
    expect(screen.queryByText('$199.97')).not.toBeInTheDocument()
    expect(cartStore.getSnapshot()).toEqual([
      expect.objectContaining({ productId: 'p-shoes', quantity: 2 }),
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
