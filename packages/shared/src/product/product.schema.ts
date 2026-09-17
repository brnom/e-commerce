import { z } from 'zod'

const fractionDigits = (digits: number) => {
  const factor = 10 ** digits
  return (value: number) => Math.round(value * factor) / factor === value
}

export const skuSchema = z
  .string({ error: 'SKU is required' })
  .trim()
  .min(1, 'SKU is required')
  .max(64, 'SKU must be at most 64 characters')
  .transform((value) => value.toUpperCase())

export const productNameSchema = z
  .string({ error: 'Name is required' })
  .trim()
  .min(1, 'Name is required')
  .max(200, 'Name must be at most 200 characters')

export const productDescriptionSchema = z
  .string()
  .trim()
  .max(2000, 'Description must be at most 2000 characters')

export const priceSchema = z
  .number({ error: 'Price must be a number' })
  .min(0, 'Price must be zero or more')
  .max(9_999_999_999.99, 'Price is too large')
  .refine(fractionDigits(2), { message: 'Price allows at most two decimal places' })

export const stockSchema = z
  .number({ error: 'Stock must be a number' })
  .int('Stock must be a whole number')
  .min(0, 'Stock must be zero or more')

export const weightKgSchema = z
  .number({ error: 'Weight must be a number' })
  .min(0, 'Weight must be zero or more')
  .max(99_999.999, 'Weight is too large')
  .refine(fractionDigits(3), { message: 'Weight allows at most three decimal places' })

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, 'Category name must not be blank')
  .max(100, 'Category name must be at most 100 characters')

export const createProductSchema = z.object({
  sku: skuSchema,
  name: productNameSchema,
  description: productDescriptionSchema.nullish(),
  price: priceSchema,
  stock: stockSchema,
  weightKg: weightKgSchema.nullish(),
  category: categoryNameSchema.nullish(),
})

export const updateProductSchema = createProductSchema.partial()

export const productSortFields = ['name', 'price', 'stock', 'createdAt'] as const

export const listProductsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.uuid().optional(),
  sort: z.enum(productSortFields).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const categoryResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
})

export const productResponseSchema = z.object({
  id: z.uuid(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  stock: z.number(),
  weightKg: z.number().nullable(),
  category: categoryResponseSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const productPageSchema = z.object({
  items: z.array(productResponseSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
})

export type CreateProductInput = z.input<typeof createProductSchema>
export type CreateProduct = z.output<typeof createProductSchema>
export type UpdateProductInput = z.input<typeof updateProductSchema>
export type UpdateProduct = z.output<typeof updateProductSchema>
export type ListProductsQueryInput = z.input<typeof listProductsQuerySchema>
export type ListProductsQuery = z.output<typeof listProductsQuerySchema>
export type ProductSortField = (typeof productSortFields)[number]
export type CategoryResponse = z.infer<typeof categoryResponseSchema>
export type ProductResponse = z.infer<typeof productResponseSchema>
export type ProductPage = z.infer<typeof productPageSchema>
