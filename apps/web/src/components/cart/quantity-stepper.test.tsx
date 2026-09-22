import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { QuantityStepper } from './quantity-stepper'

function Harness({ max, initial = 1 }: { readonly max?: number; readonly initial?: number }) {
  const [value, setValue] = useState(initial)
  return <QuantityStepper name="Running Shoes" value={value} onChange={setValue} max={max} />
}

describe('QuantityStepper', () => {
  it('increases and decreases within the bounds', async () => {
    render(<Harness max={3} />)
    const user = userEvent.setup()
    const input = screen.getByLabelText('Quantity of Running Shoes')
    const increase = screen.getByRole('button', { name: 'Increase quantity of Running Shoes' })
    const decrease = screen.getByRole('button', { name: 'Decrease quantity of Running Shoes' })

    expect(decrease).toBeDisabled()
    await user.click(increase)
    await user.click(increase)
    expect(input).toHaveValue(3)
    expect(increase).toBeDisabled()

    await user.click(decrease)
    expect(input).toHaveValue(2)
  })

  it('accepts typed values and snaps back to the bounds on blur', async () => {
    render(<Harness max={3} />)
    const user = userEvent.setup()
    const input = screen.getByLabelText('Quantity of Running Shoes')

    await user.clear(input)
    await user.type(input, '7')
    expect(input).toHaveValue(7)
    await user.tab()
    expect(input).toHaveValue(3)

    await user.clear(input)
    await user.type(input, '0')
    await user.tab()
    expect(input).toHaveValue(3)
  })

  it('reports each committed quantity', async () => {
    const onChange = vi.fn()
    render(<QuantityStepper name="Running Shoes" value={2} onChange={onChange} />)

    await userEvent.click(
      screen.getByRole('button', { name: 'Increase quantity of Running Shoes' }),
    )
    expect(onChange).toHaveBeenCalledWith(3)
  })
})
