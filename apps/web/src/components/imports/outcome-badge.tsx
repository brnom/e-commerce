import { Badge } from '@/components/ui/badge'

import type { ImportOutcome } from '@ecommerce/shared'

const variants: Record<ImportOutcome, 'default' | 'outline' | 'secondary' | 'destructive'> = {
  created: 'default',
  updated: 'outline',
  skipped: 'secondary',
  failed: 'destructive',
}

export function OutcomeBadge({ outcome }: { readonly outcome: ImportOutcome }) {
  return (
    <Badge variant={variants[outcome]} className="font-mono text-[11px] uppercase">
      {outcome}
    </Badge>
  )
}
