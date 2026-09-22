import { importJobSchema, importJobSummarySchema } from '@ecommerce/shared'
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
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'

import { ImportJobIdPipe } from './import-job-id.pipe'
import { ApiInvalidImportFile, ApiResourceNotFound } from '../openapi/api-responses'
import { GetImportJob } from '@/application/imports/get-import-job'
import { ImportProducts } from '@/application/imports/import-products'
import { ListImportJobs } from '@/application/imports/list-import-jobs'

import type { ImportJob, ImportJobSummary } from '@/domain/import/import-job'

export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024

interface UploadedCsv {
  readonly originalname: string
  readonly buffer: Buffer
}

@ApiTags('Imports')
@Controller('imports')
export class ImportsController {
  constructor(
    private readonly importProducts: ImportProducts,
    private readonly listImportJobs: ListImportJobs,
    private readonly getImportJob: GetImportJob,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_FILE_BYTES } }))
  @ApiOperation({ summary: 'Import products from a CSV file, upserting by SKU' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: `The CSV file, at most ${MAX_IMPORT_FILE_BYTES / 1024 / 1024} MB`,
    required: true,
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({
    description: 'The finished job with its per-row report',
    standardSchema: importJobSchema,
  })
  @ApiInvalidImportFile()
  upload(@UploadedFile() file: UploadedCsv | undefined): Promise<ImportJob> {
    if (!file) {
      throw new BadRequestException('A CSV file is required in the "file" field')
    }
    return this.importProducts.execute({ fileName: file.originalname, content: file.buffer })
  }

  @Get()
  @ApiOperation({ summary: 'List import jobs, newest first, without their row reports' })
  @ApiOkResponse({
    description: 'Every job summary',
    standardSchema: importJobSummarySchema,
    isArray: true,
  })
  list(): Promise<ImportJobSummary[]> {
    return this.listImportJobs.execute()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one import job with the full per-row report' })
  @ApiParam({ name: 'id', description: 'The job id, a uuid v7', format: 'uuid' })
  @ApiOkResponse({ description: 'The job', standardSchema: importJobSchema })
  @ApiResourceNotFound('import job')
  get(@Param('id', ImportJobIdPipe) id: string): Promise<ImportJob> {
    return this.getImportJob.execute(id)
  }
}
