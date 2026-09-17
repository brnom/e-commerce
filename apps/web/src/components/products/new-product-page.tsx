'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import { Breadcrumb } from './breadcrumb'
import { ProductForm } from './product-form'
import { PageHeader } from '@/components/layout/page-header'
import { categoryKeys, createProduct, productKeys } from '@/lib/products-api'

export function NewProductPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  return (
    <main>
      <Breadcrumb items={[{ href: '/products', label: 'Products' }]} current="New" />
      <PageHeader title="New product" eyebrow="Catalog" />
      <ProductForm
        submitLabel="Create product"
        onSubmit={async (values) => {
          await createProduct(values)
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: productKeys.all }),
            queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
          ])
          router.push('/products')
        }}
      />
    </main>
  )
}
