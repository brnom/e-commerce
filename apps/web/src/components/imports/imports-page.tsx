'use client'

import { ImportHistory } from './import-history'
import { UploadCard } from './upload-card'
import { PageHeader } from '@/components/layout/page-header'

export function ImportsPage() {
  return (
    <main className="flex flex-col gap-10">
      <div>
        <PageHeader title="Imports" eyebrow="Catalog" />
        <UploadCard />
      </div>
      <section className="flex flex-col gap-4">
        <h2 className="display-heading text-2xl">History</h2>
        <ImportHistory />
      </section>
    </main>
  )
}
