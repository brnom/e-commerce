'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

import { OrderStatusBadge } from './order-status-badge'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState, ErrorState } from '@/components/products/states'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateTime, formatMoney, formatShortId } from '@/lib/format'
import { listOrders, orderKeys } from '@/lib/orders-api'

const SKELETON_ROWS = 3

function OrdersList() {
  const orders = useQuery({ queryKey: orderKeys.list(), queryFn: listOrders })

  if (orders.isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading orders">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    )
  }
  if (orders.isError) {
    return <ErrorState message="Could not load the orders." onRetry={() => orders.refetch()} />
  }
  if (orders.data.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        description="Orders placed from the cart will show up here."
        action={
          <Button asChild variant="outline">
            <Link href="/products">Browse products</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-mono text-xs tracking-wider uppercase">Order</TableHead>
            <TableHead className="font-mono text-xs tracking-wider uppercase">Placed</TableHead>
            <TableHead className="font-mono text-xs tracking-wider uppercase">Customer</TableHead>
            <TableHead className="text-right font-mono text-xs tracking-wider uppercase">
              Items
            </TableHead>
            <TableHead className="text-right font-mono text-xs tracking-wider uppercase">
              Total
            </TableHead>
            <TableHead className="font-mono text-xs tracking-wider uppercase">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.data.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-mono font-medium">
                <Link href={`/orders/${order.id}`} className="text-link">
                  {formatShortId(order.id)}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateTime(order.createdAt)}
              </TableCell>
              <TableCell>{order.customer.name}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{order.itemCount}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatMoney(order.total)}
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={order.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function OrdersPage() {
  return (
    <main className="flex flex-col gap-4">
      <PageHeader title="Orders" eyebrow="Purchase" />
      <OrdersList />
    </main>
  )
}
