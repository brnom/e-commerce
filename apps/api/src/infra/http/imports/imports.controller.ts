import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'

import { ImportJobIdPipe } from './import-job-id.pipe'
import { GetImportJob } from '@/application/imports/get-import-job'
import { ImportProducts } from '@/application/imports/import-products'
import { ListImportJobs } from '@/application/imports/list-import-jobs'

import type { ImportJob, ImportJobSummary } from '@/domain/import/import-job'

export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024

interface UploadedCsv {
  readonly originalname: string
  readonly buffer: Buffer
}

@Controller('imports')
export class ImportsController {
  constructor(
    private readonly importProducts: ImportProducts,
    private readonly listImportJobs: ListImportJobs,
    private readonly getImportJob: GetImportJob,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_FILE_BYTES } }))
  upload(@UploadedFile() file: UploadedCsv | undefined): Promise<ImportJob> {
    if (!file) {
      throw new BadRequestException('A CSV file is required in the "file" field')
    }
    return this.importProducts.execute({ fileName: file.originalname, content: file.buffer })
  }

  @Get()
  list(): Promise<ImportJobSummary[]> {
    return this.listImportJobs.execute()
  }

  @Get(':id')
  get(@Param('id', ImportJobIdPipe) id: string): Promise<ImportJob> {
    return this.getImportJob.execute(id)
  }
}
