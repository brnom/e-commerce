import { unavailableItemsBodySchema } from '@ecommerce/shared'
import { z } from 'zod'

export const validationErrorSchema = z.object({
  message: z.string(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })),
})

export const notFoundErrorSchema = z.object({
  message: z.string(),
  resource: z.string(),
})

export const conflictErrorSchema = z.object({
  message: z.string(),
  field: z.string(),
  value: z.string(),
})

export const invalidImportFileErrorSchema = z.object({
  message: z.string(),
  missingColumns: z.array(z.string()),
})

export const unavailableItemsErrorSchema = unavailableItemsBodySchema

export const uploadTooLargeErrorSchema = z.object({
  message: z.string(),
  error: z.string(),
  statusCode: z.literal(413),
})

const healthIndicators = z.record(z.string(), z.object({ status: z.string() }))

export const healthReportSchema = z.object({
  status: z.string(),
  info: healthIndicators.optional(),
  error: healthIndicators.optional(),
  details: healthIndicators,
})
