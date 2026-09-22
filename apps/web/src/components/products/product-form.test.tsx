import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProductForm } from './product-form'
import { ApiError } from '@/lib/api-client'
import { calls, renderWithQuery, stubApi } from '@/test-utils'

describe('ProductForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('blocks submission and shows field messages without calling the API', async () => {
    const fetchMock = stubApi([{ path: /\/categories$/, body: [] }])
    const onSubmit = vi.fn()
    renderWithQuery(<ProductForm submitLabel="Create" onSubmit={onSubmit} />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('SKU'), 'NEW-1')
    await user.type(screen.getByLabelText('Price'), '-1')
    await user.type(screen.getByLabelText('Stock'), '1')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Price must be zero or more')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(calls(fetchMock, 'POST')).toHaveLength(0)
  })

  it('places a 409 conflict message next to the SKU field', async () => {
    stubApi([{ path: /\/categories$/, body: [] }])
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError(409, {
        message: 'sku "RS-001" is already taken',
        field: 'sku',
        value: 'RS-001',
      }),
    )
    renderWithQuery(<ProductForm submitLabel="Create" onSubmit={onSubmit} />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('SKU'), 'rs-001')
    await user.type(screen.getByLabelText('Name'), 'Running Shoes')
    await user.type(screen.getByLabelText('Price'), '89.99')
    await user.type(screen.getByLabelText('Stock'), '150')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    const skuField = screen.getByLabelText('SKU')
    expect(await screen.findByText('sku "RS-001" is already taken')).toBeInTheDocument()
    expect(skuField).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ sku: 'RS-001', name: 'Running Shoes', price: 89.99, stock: 150 }),
    )
  })

  it('keeps an absent weight empty instead of turning it into zero', async () => {
    stubApi([{ path: /\/categories$/, body: [] }])
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    renderWithQuery(
      <ProductForm
        submitLabel="Save"
        onSubmit={onSubmit}
        defaultValues={{ sku: 'GK-088', name: 'Gift Card', price: 25, stock: 10, weightKg: null }}
      />,
    )

    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(null)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ weightKg: null, price: 25, stock: 10 })
  })

  it('follows fresh values while keeping fields the user already edited', async () => {
    stubApi([{ path: /\/categories$/, body: [] }])
    const product = {
      sku: 'RS-001',
      name: 'Running Shoes',
      price: 89.99,
      stock: 150,
      weightKg: 0.5,
    }
    function Harness() {
      const [values, setValues] = useState(product)
      return (
        <>
          <ProductForm submitLabel="Save" onSubmit={vi.fn()} values={values} />
          <button type="button" onClick={() => setValues({ ...product, stock: 148 })}>
            Refetch
          </button>
        </>
      )
    }
    renderWithQuery(<Harness />)
    const user = userEvent.setup()

    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Trail Shoes')
    await user.click(screen.getByRole('button', { name: 'Refetch' }))

    await vi.waitFor(() => expect(screen.getByLabelText('Stock')).toHaveValue(148))
    expect(screen.getByLabelText('Name')).toHaveValue('Trail Shoes')
  })

  it('offers existing categories as suggestions', async () => {
    stubApi([{ path: /\/categories$/, body: [{ id: 'c1', name: 'Footwear' }] }])
    renderWithQuery(<ProductForm submitLabel="Create" onSubmit={vi.fn()} />)

    await vi.waitFor(() =>
      expect(document.querySelector('datalist option[value="Footwear"]')).not.toBeNull(),
    )
  })
})
