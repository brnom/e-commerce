import { Module } from '@nestjs/common'

import { ImportJobIdPipe } from './import-job-id.pipe'
import { ImportsController } from './imports.controller'
import { GetImportJob } from '@/application/imports/get-import-job'
import { ImportProducts } from '@/application/imports/import-products'
import { ListImportJobs } from '@/application/imports/list-import-jobs'
import { IMPORT_JOB_REPOSITORY } from '@/application/ports/import-job-repository'
import { PrismaImportJobRepository } from '@/infra/persistence/prisma/prisma-import-job.repository'

import type { ImportJobRepository } from '@/application/ports/import-job-repository'

@Module({
  controllers: [ImportsController],
  providers: [
    ImportJobIdPipe,
    { provide: IMPORT_JOB_REPOSITORY, useClass: PrismaImportJobRepository },
    {
      provide: ImportProducts,
      useFactory: (imports: ImportJobRepository) => new ImportProducts(imports),
      inject: [IMPORT_JOB_REPOSITORY],
    },
    {
      provide: ListImportJobs,
      useFactory: (imports: ImportJobRepository) => new ListImportJobs(imports),
      inject: [IMPORT_JOB_REPOSITORY],
    },
    {
      provide: GetImportJob,
      useFactory: (imports: ImportJobRepository) => new GetImportJob(imports),
      inject: [IMPORT_JOB_REPOSITORY],
    },
  ],
})
export class ImportsModule {}
