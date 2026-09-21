import Link from 'next/link'

import { NotFoundState } from './states'
import { Button } from '@/components/ui/button'

export function ProductNotFound() {
  return (
    <NotFoundState
      title="Product not found"
      description="This product does not exist or has been deleted."
      action={
        <Button asChild variant="outline">
          <Link href="/products">Back to products</Link>
        </Button>
      }
    />
  )
}
