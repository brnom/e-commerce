import type { ImportTotals } from '@ecommerce/shared'

export const totalLabels: ReadonlyArray<{ key: keyof ImportTotals; label: string }> = [
  { key: 'rows', label: 'Rows' },
  { key: 'created', label: 'Created' },
  { key: 'updated', label: 'Updated' },
  { key: 'skipped', label: 'Skipped' },
  { key: 'failed', label: 'Failed' },
]

export function ImportTotalsSheet({ totals }: { readonly totals: ImportTotals }) {
  return (
    <dl className="grid grid-cols-3 gap-x-6 gap-y-8 sm:grid-cols-5">
      {totalLabels.map((entry) => (
        <div key={entry.key}>
          <dt className="mb-1 font-mono text-xs tracking-wider text-muted-foreground uppercase">
            {entry.label}
          </dt>
          <dd className="font-mono text-3xl tabular-nums sm:text-4xl">{totals[entry.key]}</dd>
        </div>
      ))}
    </dl>
  )
}
