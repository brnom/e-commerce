'use client'

import { ArrowRight, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/products/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cartStore, cartTotal, lineTotal, useCart, type CartLine } from '@/lib/cart-store'
import { formatMoney } from '@/lib/format'

export function CartEmptyState() {
  return (
    <EmptyState
      title="Your cart is empty"
      description="Add products from the catalog to start an order."
      action={
        <Button asChild>
          <Link href="/products">Browse products</Link>
        </Button>
      }
    />
  )
}

type Draft = { readonly raw: string; readonly quantity: number }

function QuantityInput({ line }: { readonly line: CartLine }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const raw = draft && draft.quantity === line.quantity ? draft.raw : String(line.quantity)
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={1}
      aria-label={`Quantity of ${line.name}`}
      value={raw}
      onChange={(event) => {
        const next = Number.parseInt(event.target.value, 10)
        if (next >= 1) cartStore.setQuantity(line.productId, next)
        setDraft({ raw: event.target.value, quantity: next >= 1 ? next : line.quantity })
      }}
      onBlur={() => setDraft(null)}
      className="ml-auto w-20 text-right font-mono tabular-nums"
    />
  )
}

export function CartLinesTable({
  lines,
  editable,
}: {
  readonly lines: readonly CartLine[]
  readonly editable: boolean
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-mono text-xs tracking-wider uppercase">Product</TableHead>
            <TableHead className="text-right font-mono text-xs tracking-wider uppercase">
              Unit price
            </TableHead>
            <TableHead className="text-right font-mono text-xs tracking-wider uppercase">
              Quantity
            </TableHead>
            <TableHead className="text-right font-mono text-xs tracking-wider uppercase">
              Total
            </TableHead>
            {editable && <TableHead className="sr-only">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.productId}>
              <TableCell>
                <Link
                  href={`/products/${line.productId}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {line.name}
                </Link>
                <p className="font-mono text-xs text-muted-foreground">{line.sku}</p>
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatMoney(line.unitPrice)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {editable ? <QuantityInput line={line} /> : line.quantity}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatMoney(lineTotal(line))}
              </TableCell>
              {editable && (
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${line.name}`}
                    onClick={() => cartStore.remove(line.productId)}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function CartTotal({ lines }: { readonly lines: readonly CartLine[] }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-t pt-4">
      <span className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
        Total
      </span>
      <span className="display-heading text-3xl tabular-nums">{formatMoney(cartTotal(lines))}</span>
    </div>
  )
}

export function CartPage() {
  const lines = useCart()

  return (
    <main className="flex flex-col gap-8">
      <PageHeader title="Cart" eyebrow="Purchase" />
      {lines.length === 0 ? (
        <CartEmptyState />
      ) : (
        <>
          <CartLinesTable lines={lines} editable />
          <div className="flex flex-col gap-6 sm:ml-auto sm:w-80">
            <CartTotal lines={lines} />
            <Button asChild size="lg">
              <Link href="/checkout">
                Checkout
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </>
      )}
    </main>
  )
}
