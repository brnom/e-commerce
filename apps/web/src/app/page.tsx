import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <main className="flex flex-col gap-10 py-10 sm:py-20">
      <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
        Catalog · Search · Purchase
      </p>
      <h1 className="max-w-4xl display-heading text-5xl leading-none sm:text-7xl lg:text-8xl">
        Everything in stock, one table away.
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Manage products, search the catalog and keep stock honest. No pictures, just the facts.
      </p>
      <div>
        <Button asChild size="lg">
          <Link href="/products">
            Browse products
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </main>
  )
}
