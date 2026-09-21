import { NotFoundError } from '@/domain/shared/domain-error'

import type { ImportJobRepository } from '@/application/ports/import-job-repository'
import type { ImportJob } from '@/domain/import/import-job'

export class GetImportJob {
  constructor(private readonly imports: ImportJobRepository) {}

  async execute(id: string): Promise<ImportJob> {
    const job = await this.imports.findById(id)
    if (!job) {
      throw new NotFoundError('import', id)
    }
    return job
  }
}
