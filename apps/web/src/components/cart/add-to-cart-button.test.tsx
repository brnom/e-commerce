import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { AddToCartButton } from './add-to-cart-button'
import { cartStore } from '@/lib/cart-store'
import { renderWithQuery } from '@/test-utils'

const shoes = { id: 'p-shoes', sku: 'RS-001', name: 'Running Shoes', price: 89.99, stock: 5 }

describe('AddToCartButton', () => {
  beforeEach(() => {
    cartStore.clear()
  })

  it('adds the product with the given quantity and accumulates on a second click', async () => {
    renderWithQuery(<AddToCartButton product={shoes} quantity={2} />)

    const button = screen.getByRole('button', { name: 'Add Running Shoes to cart' })
    await userEvent.click(button)
    expect(button).toHaveTextContent('Added')
    await userEvent.click(button)

    expect(cartStore.getSnapshot()).toEqual([
      expect.objectContaining({ productId: 'p-shoes', quantity: 4 }),
    ])
  })

  it('is disabled and labelled when the product is out of stock', () => {
    renderWithQuery(<AddToCartButton product={{ ...shoes, stock: 0 }} />)

    const button = screen.getByRole('button', { name: 'Out of stock: Running Shoes' })
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('Out of stock')
  })
})
