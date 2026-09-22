'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

import { totalLabels } from './import-totals'
import { EmptyState, ErrorState } from '@/components/products/states'
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
import { importKeys, listImports } from '@/lib/imports-api'

const SKELETON_ROWS = 3

const counters = totalLabels.filter((entry) => entry.key !== 'rows')

export function ImportHistory() {
  const jobs = useQuery({ queryKey: importKeys.list(), queryFn: listImports })

  if (jobs.isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading imports">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    )
  }
  if (jobs.isError) {
    return (
      <ErrorState message="Could not load the import history." onRetry={() => jobs.refetch()} />
    )
  }
  if (jobs.data.length === 0) {
    return (
      <EmptyState
        title="No imports yet"
        description="Upload a CSV file above to load products in bulk."
      />
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-mono text-xs tracking-wider uppercase">Import</TableHead>
            <TableHead className="font-mono text-xs tracking-wider uppercase">File</TableHead>
            <TableHead className="font-mono text-xs tracking-wider uppercase">Imported</TableHead>
            {counters.map((entry) => (
              <TableHead
                key={entry.key}
                className="text-right font-mono text-xs tracking-wider uppercase"
              >
                {entry.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.data.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-mono text-muted-foreground">
                {formatShortId(job.id)}
              </TableCell>
              <TableCell className="font-medium">
                <Link href={`/imports/${job.id}`} className="text-link">
                  {job.fileName}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateTime(job.createdAt)}
              </TableCell>
              {counters.map((entry) => (
                <TableCell key={entry.key} className="text-right font-mono tabular-nums">
                  {job.totals[entry.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
