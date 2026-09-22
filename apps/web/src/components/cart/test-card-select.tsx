'use client'

import { testCards, type PaymentCardInput, type TestCard } from '@ecommerce/shared'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const CUSTOM_CARD = 'custom'

export type CardSelection = TestCard['id'] | typeof CUSTOM_CARD

const TEST_CARD_YEARS_AHEAD = 3
const TEST_CARD_CVC = '123'

export function testCardExpiry(now: Date = new Date()): string {
  const year = (now.getFullYear() + TEST_CARD_YEARS_AHEAD) % 100
  return `12/${String(year).padStart(2, '0')}`
}

export function testCardValues(card: TestCard, cardholderName: string): PaymentCardInput {
  return {
    cardholderName,
    cardNumber: card.number,
    expiry: testCardExpiry(),
    cvc: TEST_CARD_CVC,
  }
}

export const emptyCardValues: PaymentCardInput = {
  cardholderName: '',
  cardNumber: '',
  expiry: '',
  cvc: '',
}

const groupDigits = (number: string) => number.replace(/(\d{4})(?=\d)/g, '$1 ')

export function TestCardSelect({
  value,
  onChange,
}: {
  readonly value: CardSelection
  readonly onChange: (selection: CardSelection) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="card-selection">Card</Label>
      <Select value={value} onValueChange={(next) => onChange(next as CardSelection)}>
        <SelectTrigger id="card-selection" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {testCards.map((card) => (
            <SelectItem key={card.id} value={card.id}>
              <span className="font-medium">{card.label}</span>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {groupDigits(card.number)}
              </span>
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_CARD}>Enter another card</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

export function TestCardTile({
  card,
  cardholderName,
  expiry,
  issues,
}: {
  readonly card: TestCard
  readonly cardholderName: string
  readonly expiry: string
  readonly issues: readonly string[]
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        aria-label={`${card.label} test card ending in ${card.number.slice(-4)}`}
        className="flex aspect-[1.6/1] max-w-sm animate-in flex-col justify-between rounded-xl bg-foreground p-5 text-background fade-in"
      >
        <div className="flex justify-between font-mono text-[11px] tracking-wider uppercase opacity-70">
          <span>Test card</span>
          <span>{card.label}</span>
        </div>
        <p className="font-mono text-lg tracking-[0.18em] tabular-nums sm:text-xl">
          •••• •••• •••• {card.number.slice(-4)}
        </p>
        <div className="flex justify-between gap-4 font-mono text-xs tracking-wider uppercase">
          <span className="truncate">{cardholderName || '—'}</span>
          <span className="tabular-nums">{expiry}</span>
        </div>
      </div>
      {issues.length > 0 && (
        <ul role="alert" className="text-sm text-destructive">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
