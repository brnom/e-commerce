import type { ImportJobRepository } from '@/application/ports/import-job-repository'
import type { ImportJobSummary } from '@/domain/import/import-job'

export class ListImportJobs {
  constructor(private readonly imports: ImportJobRepository) {}

  execute(): Promise<ImportJobSummary[]> {
    return this.imports.findAll()
  }
}
