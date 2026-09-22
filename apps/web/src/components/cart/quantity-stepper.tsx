'use client'

import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  readonly name: string
  readonly value: number
  readonly onChange: (quantity: number) => void
  readonly min?: number
  readonly max?: number
  readonly disabled?: boolean
  readonly id?: string
  readonly className?: string
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export function QuantityStepper({
  name,
  value,
  onChange,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
  disabled = false,
  id,
  className,
}: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const raw = draft ?? String(value)

  const commit = (next: number) => {
    const quantity = clamp(next, min, max)
    if (quantity !== value) onChange(quantity)
  }

  return (
    <div
      className={cn(
        'inline-flex h-9 items-stretch rounded-md border shadow-xs has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50',
        disabled && 'opacity-50',
        className,
      )}
    >
      <Button
        type="button"
        variant="invert"
        size="icon-sm"
        className="h-auto rounded-r-none hover:shadow-none active:scale-100 active:bg-foreground/70"
        aria-label={`Decrease quantity of ${name}`}
        disabled={disabled || value <= min}
        onClick={() => commit(value - 1)}
      >
        <Minus />
      </Button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max === Number.MAX_SAFE_INTEGER ? undefined : max}
        aria-label={`Quantity of ${name}`}
        value={raw}
        disabled={disabled}
        onChange={(event) => {
          setDraft(event.target.value)
          const next = Number.parseInt(event.target.value, 10)
          if (Number.isInteger(next) && next >= min) commit(next)
        }}
        onBlur={() => setDraft(null)}
        className="w-12 [appearance:textfield] border-x bg-transparent text-center font-mono text-sm tabular-nums outline-none disabled:cursor-not-allowed [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <Button
        type="button"
        variant="invert"
        size="icon-sm"
        className="h-auto rounded-l-none hover:shadow-none active:scale-100 active:bg-foreground/70"
        aria-label={`Increase quantity of ${name}`}
        disabled={disabled || value >= max}
        onClick={() => commit(value + 1)}
      >
        <Plus />
      </Button>
    </div>
  )
}
