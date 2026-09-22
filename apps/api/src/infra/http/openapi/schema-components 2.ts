import {
  categoryResponseSchema,
  checkoutCustomerSchema,
  createProductSchema,
  importIssueSchema,
  importJobSchema,
  importJobSummarySchema,
  importRowReportSchema,
  importTotalsSchema,
  orderCustomerSchema,
  orderItemSchema,
  orderLineSchema,
  orderPaymentSchema,
  orderResponseSchema,
  orderSummarySchema,
  placeOrderSchema,
  productPageSchema,
  productResponseSchema,
  unavailableItemSchema,
  updateProductSchema,
} from '@ecommerce/shared'
import { z } from 'zod'

import {
  conflictErrorSchema,
  healthReportSchema,
  invalidImportFileErrorSchema,
  notFoundErrorSchema,
  unavailableItemsErrorSchema,
  validationErrorSchema,
} from './error-schemas'

import type { ZodType } from 'zod'

const components: ReadonlyArray<readonly [string, ZodType]> = [
  ['Category', categoryResponseSchema],
  ['CreateProduct', createProductSchema],
  ['UpdateProduct', updateProductSchema],
  ['Product', productResponseSchema],
  ['ProductPage', productPageSchema],
  ['ImportIssue', importIssueSchema],
  ['ImportRowReport', importRowReportSchema],
  ['ImportTotals', importTotalsSchema],
  ['ImportJobSummary', importJobSummarySchema],
  ['ImportJob', importJobSchema],
  ['CheckoutCustomer', checkoutCustomerSchema],
  ['OrderItem', orderItemSchema],
  ['PlaceOrder', placeOrderSchema],
  ['OrderCustomer', orderCustomerSchema],
  ['OrderLine', orderLineSchema],
  ['OrderPayment', orderPaymentSchema],
  ['OrderSummary', orderSummarySchema],
  ['Order', orderResponseSchema],
  ['UnavailableItem', unavailableItemSchema],
  ['HealthReport', healthReportSchema],
  ['ValidationError', validationErrorSchema],
  ['NotFoundError', notFoundErrorSchema],
  ['ConflictError', conflictErrorSchema],
  ['UnavailableItemsError', unavailableItemsErrorSchema],
  ['InvalidImportFileError', invalidImportFileErrorSchema],
]

export function registerSchemaComponents(): void {
  for (const [id, schema] of components) {
    if (!z.globalRegistry.has(schema)) {
      z.globalRegistry.add(schema, { id })
    }
  }
}
