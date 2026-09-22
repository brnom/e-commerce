'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'

import { ImportTotalsSheet } from './import-totals'
import { OutcomeBadge } from './outcome-badge'
import { Breadcrumb } from '@/components/products/breadcrumb'
import { ErrorState, NotFoundState } from '@/components/products/states'
import { isNotFound } from '@/components/products/use-product'
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
import { formatDateTime, formatShortId } from '@/lib/format'
import { getImport, importKeys } from '@/lib/imports-api'

import type { ImportRowReport } from '@ecommerce/shared'

const isProblem = (row: ImportRowReport) => row.outcome === 'failed' || row.outcome === 'skipped'

function RowsTable({ rows }: { readonly rows: ImportRowReport[] }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 text-right font-mono text-xs tracking-wider uppercase">
              Line
            </TableHead>
            <TableHead className="font-mono text-xs tracking-wider uppercase">SKU</TableHead>
            <TableHead className="font-mono text-xs tracking-wider uppercase">Name</TableHead>
            <TableHead className="font-mono text-xs tracking-wider uppercase">Outcome</TableHead>
            <TableHead className="font-mono text-xs tracking-wider uppercase">Issues</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.line}>
              <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
                {row.line}
              </TableCell>
              <TableCell className="font-mono">{row.sku ?? '—'}</TableCell>
              <TableCell className="max-w-xs truncate">{row.name ?? '—'}</TableCell>
              <TableCell>
                <OutcomeBadge outcome={row.outcome} />
              </TableCell>
              <TableCell>
                {row.issues.length > 0 && (
                  <ul className="space-y-0.5 text-sm">
                    {row.issues.map((issue) => (
                      <li key={`${issue.path}-${issue.message}`}>
                        <span className="font-mono text-xs text-muted-foreground">
                          {issue.path}
                        </span>{' '}
                        — {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function ImportReportPage({ importId }: { readonly importId: string }) {
  const [problemsOnly, setProblemsOnly] = useState(false)
  const job = useQuery({
    queryKey: importKeys.detail(importId),
    queryFn: () => getImport(importId),
    retry: (count, error) => !isNotFound(error) && count < 1,
  })

  if (job.isError && isNotFound(job.error)) {
    return (
      <main>
        <NotFoundState
          title="Import not found"
          description="This import does not exist."
          action={
            <Button asChild variant="outline">
              <Link href="/imports">Back to imports</Link>
            </Button>
          }
        />
      </main>
    )
  }

  const visibleRows = job.data?.rows.filter((row) => !problemsOnly || isProblem(row)) ?? []
  const problemCount = job.data ? job.data.totals.failed + job.data.totals.skipped : 0

  return (
    <main>
      <Breadcrumb
        items={[{ href: '/imports', label: 'Imports' }]}
        current={job.data ? `${formatShortId(job.data.id)} ${job.data.fileName}` : 'Import'}
      />
      {job.isPending && (
        <div className="space-y-6" aria-busy="true" aria-label="Loading import">
          <Skeleton className="h-20 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}
      {job.isError && (
        <ErrorState message="Could not load the import." onRetry={() => job.refetch()} />
      )}
      {job.data && (
        <article className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
              {formatShortId(job.data.id)} · Imported {formatDateTime(job.data.createdAt)}
            </p>
            <h1 className="display-heading text-4xl leading-none wrap-anywhere sm:text-6xl">
              {job.data.fileName}
            </h1>
          </div>
          <ImportTotalsSheet totals={job.data.totals} />
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="display-heading text-2xl">Rows</h2>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={problemsOnly}
                className="aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/85"
                onClick={() => setProblemsOnly((value) => !value)}
              >
                Problems only
                <span className="font-mono tabular-nums">{problemCount}</span>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/products">View products</Link>
              </Button>
            </div>
          </div>
          <RowsTable rows={visibleRows} />
        </article>
      )}
    </main>
  )
}
