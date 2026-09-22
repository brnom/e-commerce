'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

import { OrderStatusBadge } from './order-status-badge'
import { Breadcrumb } from '@/components/products/breadcrumb'
import { ErrorState, NotFoundState } from '@/components/products/states'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ApiError } from '@/lib/api-client'
import { formatDateTime, formatMoney, formatShortId } from '@/lib/format'
import { getOrder, orderKeys } from '@/lib/orders-api'

import type { OrderResponse } from '@ecommerce/shared'

const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404

function OrderNotFound() {
  return (
    <NotFoundState
      title="Order not found"
      description="This order does not exist."
      action={
        <Button asChild variant="outline">
          <Link href="/orders">Back to orders</Link>
        </Button>
      }
    />
  )
}

function OrderSheet({ order }: { readonly order: OrderResponse }) {
  const rows: ReadonlyArray<{ label: string; value: string }> = [
    { label: 'Customer', value: order.customer.name },
    { label: 'Email', value: order.customer.email },
    { label: 'Card', value: `•••• ${order.payment.cardLast4}` },
    order.payment.reference
      ? { label: 'Payment reference', value: order.payment.reference }
      : { label: 'Decline reason', value: order.payment.declineReason ?? '—' },
    { label: 'Placed', value: formatDateTime(order.createdAt) },
    { label: 'Updated', value: formatDateTime(order.updatedAt) },
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="mb-1 font-mono text-xs tracking-wider text-muted-foreground uppercase">
            {row.label}
          </dt>
          <dd className="text-lg wrap-anywhere">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function OrderLines({ order }: { readonly order: OrderResponse }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-mono text-xs tracking-wider uppercase">Product</TableHead>
            <TableHead className="font-mono text-xs tracking-wider uppercase">SKU</TableHead>
            <TableHead className="text-right font-mono text-xs tracking-wider uppercase">
              Unit price
            </TableHead>
            <TableHead className="text-right font-mono text-xs tracking-wider uppercase">
              Quantity
            </TableHead>
            <TableHead className="text-right font-mono text-xs tracking-wider uppercase">
              Total
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.lines.map((line) => (
            <TableRow key={line.productId}>
              <TableCell className="font-medium">
                <Link href={`/products/${line.productId}`} className="text-link">
                  {line.name}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{line.sku}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatMoney(line.unitPrice)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">{line.quantity}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatMoney(line.lineTotal)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function OrderPage({ orderId }: { readonly orderId: string }) {
  const order = useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: () => getOrder(orderId),
    retry: (count, error) => !isNotFound(error) && count < 1,
  })

  if (order.isError && isNotFound(order.error)) {
    return (
      <main>
        <OrderNotFound />
      </main>
    )
  }

  return (
    <main>
      <Breadcrumb items={[{ href: '/orders', label: 'Orders' }]} current={formatShortId(orderId)} />
      {order.isPending && (
        <div className="space-y-6" aria-busy="true" aria-label="Loading order">
          <Skeleton className="h-20 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}
      {order.isError && (
        <ErrorState message="Could not load the order." onRetry={() => order.refetch()} />
      )}
      {order.data && (
        <article className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <OrderStatusBadge status={order.data.status} />
            <h1 className="display-heading text-4xl leading-none sm:text-6xl">
              Order {formatShortId(order.data.id)}
            </h1>
            <p className="font-mono text-4xl tabular-nums sm:text-5xl">
              {formatMoney(order.data.total)}
            </p>
          </div>
          <Separator />
          <OrderSheet order={order.data} />
          <Separator />
          <OrderLines order={order.data} />
        </article>
      )}
    </main>
  )
}
