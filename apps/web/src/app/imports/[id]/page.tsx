import { ImportReportPage } from '@/components/imports/import-report-page'

export default async function ImportReportRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ImportReportPage importId={id} />
}
