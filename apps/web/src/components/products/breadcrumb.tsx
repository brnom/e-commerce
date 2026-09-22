import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Fragment } from 'react'

interface Props {
  readonly items: ReadonlyArray<{ href: string; label: string }>
  readonly current: string
}

export function Breadcrumb({ items, current }: Props) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-6 flex items-center gap-1 font-mono text-xs tracking-wider text-muted-foreground uppercase"
    >
      {items.map((item) => (
        <Fragment key={item.href}>
          <Link href={item.href} className="text-link hover:text-foreground">
            {item.label}
          </Link>
          <ChevronRight aria-hidden="true" className="size-3" />
        </Fragment>
      ))}
      <span aria-current="page" className="text-foreground">
        {current}
      </span>
    </nav>
  )
}
