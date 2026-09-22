import { Badge } from '@/components/ui/badge'

import type { OrderStatus } from '@ecommerce/shared'

const variants: Record<OrderStatus, 'default' | 'outline' | 'secondary' | 'destructive'> = {
  pending: 'secondary',
  paid: 'default',
  payment_failed: 'destructive',
}

const labels: Record<OrderStatus, string> = {
  pending: 'pending',
  paid: 'paid',
  payment_failed: 'payment failed',
}

export function OrderStatusBadge({ status }: { readonly status: OrderStatus }) {
  return (
    <Badge variant={variants[status]} className="font-mono text-[11px] uppercase">
      {labels[status]}
    </Badge>
  )
}
