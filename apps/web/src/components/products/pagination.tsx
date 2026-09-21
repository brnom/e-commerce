import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface Props {
  readonly page: number
  readonly limit: number
  readonly total: number
  readonly onPageChange: (page: number) => void
}

export function Pagination({ page, limit, total, onPageChange }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / limit))
  return (
    <nav
      className="mt-6 flex items-center justify-between gap-4 font-mono text-xs tracking-wider uppercase"
      aria-label="Pagination"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft />
        Previous
      </Button>
      <span className="text-muted-foreground">
        Page {page} of {pageCount}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next
        <ChevronRight />
      </Button>
    </nav>
  )
}
