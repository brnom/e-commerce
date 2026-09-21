import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProductsTable } from './products-table'
import { cartStore } from '@/lib/cart-store'
import { defaultListState } from '@/lib/product-list-params'
import { calls, renderWithQuery, stubApi } from '@/test-utils'

import type { ProductResponse } from '@ecommerce/shared'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const product = (overrides: Partial<ProductResponse>): ProductResponse => ({
  id: '01a0c40d-90c3-750a-af78-7d4aa60d284e',
  sku: 'RS-001',
  name: 'Running Shoes',
  description: null,
  price: 89.99,
  stock: 150,
  weightKg: null,
  category: { id: 'c1', name: 'Footwear' },
  createdAt: '2026-09-21T00:00:00.000Z',
  updatedAt: '2026-09-21T00:00:00.000Z',
  ...overrides,
})

const renderTable = (items: ProductResponse[], onSort = vi.fn()) =>
  renderWithQuery(<ProductsTable items={items} state={defaultListState} onSort={onSort} />)

describe('ProductsTable', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    cartStore.clear()
  })

  it('adds one unit to the cart per click and disables the control when out of stock', async () => {
    stubApi([])
    renderTable([
      product({}),
      product({ id: 'p-2', sku: 'WM-042', name: 'Wireless Mouse', stock: 0 }),
    ])
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Add Running Shoes to cart' }))
    await user.click(screen.getByRole('button', { name: 'Add Running Shoes to cart' }))

    expect(cartStore.getSnapshot()).toEqual([
      expect.objectContaining({ productId: '01a0c40d-90c3-750a-af78-7d4aa60d284e', quantity: 2 }),
    ])
    expect(screen.getByRole('button', { name: 'Out of stock: Wireless Mouse' })).toBeDisabled()
  })

  it('renders markup in product fields as literal text', () => {
    stubApi([])
    const name = "<script>alert('xss')</script>"
    renderTable([product({ name })])

    expect(screen.getByRole('link', { name })).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
  })

  it('links the product name to its detail page', () => {
    stubApi([])
    renderTable([product({})])

    expect(screen.getByRole('link', { name: 'Running Shoes' })).toHaveAttribute(
      'href',
      '/products/01a0c40d-90c3-750a-af78-7d4aa60d284e',
    )
  })

  it('opens a confirmation dialog and sends nothing when cancelled', async () => {
    const fetchMock = stubApi([{ method: 'DELETE', path: /\/products\//, status: 204 }])
    renderTable([product({})])
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Delete Running Shoes' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete product?' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(calls(fetchMock, 'DELETE')).toHaveLength(0)
    expect(screen.getByRole('link', { name: 'Running Shoes' })).toBeInTheDocument()
  })

  it('closes the dialog on Escape and returns focus to the trigger', async () => {
    const fetchMock = stubApi([{ method: 'DELETE', path: /\/products\//, status: 204 }])
    renderTable([product({})])
    const user = userEvent.setup()
    const trigger = screen.getByRole('button', { name: 'Delete Running Shoes' })

    await user.click(trigger)
    await screen.findByRole('alertdialog')
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(calls(fetchMock, 'DELETE')).toHaveLength(0)
    expect(trigger).toHaveFocus()
  })

  it('sends the delete request once confirmed', async () => {
    const fetchMock = stubApi([{ method: 'DELETE', path: /\/products\//, status: 204 }])
    renderTable([product({})])
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Delete Running Shoes' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await vi.waitFor(() => expect(calls(fetchMock, 'DELETE')).toHaveLength(1))
    expect(calls(fetchMock, 'DELETE')[0]?.[0]).toMatch(
      /\/products\/01a0c40d-90c3-750a-af78-7d4aa60d284e$/,
    )
  })

  it('reports the active sort on the column header and toggles on click', async () => {
    stubApi([])
    const onSort = vi.fn()
    renderWithQuery(
      <ProductsTable
        items={[product({})]}
        state={{ ...defaultListState, sort: 'price', order: 'asc' }}
        onSort={onSort}
      />,
    )

    expect(screen.getByRole('columnheader', { name: /Price/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )
    await userEvent.setup().click(screen.getByRole('button', { name: /Stock/ }))
    expect(onSort).toHaveBeenCalledWith('stock')
  })
})
