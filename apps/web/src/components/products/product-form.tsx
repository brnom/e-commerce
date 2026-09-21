'use client'

import { createProductSchema, type CreateProductInput } from '@ecommerce/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useForm, type FieldPath } from 'react-hook-form'

import { useCategories } from './use-categories'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api-client'

export type ProductFormValues = CreateProductInput

interface Props {
  readonly defaultValues?: Partial<ProductFormValues>
  readonly submitLabel: string
  readonly onSubmit: (values: ProductFormValues) => Promise<unknown>
}

const fieldNames: ReadonlySet<string> = new Set([
  'sku',
  'name',
  'description',
  'price',
  'stock',
  'weightKg',
  'category',
])

const isFieldName = (path: string): path is FieldPath<ProductFormValues> => fieldNames.has(path)

type ValidationBody = { issues?: Array<{ path: string; message: string }> }
type ConflictBody = { field?: string; message?: string }

const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() !== '' ? value : null
const numberOrUndefined = (value: unknown) =>
  typeof value === 'number' ? value : value === '' || value == null ? undefined : Number(value)
const numberOrNull = (value: unknown) =>
  typeof value === 'number' ? value : value === '' || value == null ? null : Number(value)

export function ProductForm({ defaultValues, submitLabel, onSubmit }: Props) {
  const categories = useCategories()
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { description: '', category: '', ...defaultValues },
  })
  const { errors, isSubmitting } = form.formState

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values)
    } catch (error) {
      if (!applyApiError(error)) {
        form.setError('root', { message: 'The product could not be saved. Try again.' })
      }
    }
  })

  function applyApiError(error: unknown): boolean {
    if (!(error instanceof ApiError)) return false
    if (error.status === 400) {
      const issues = (error.body as ValidationBody).issues ?? []
      const fieldIssues = issues.filter((issue) => isFieldName(issue.path))
      for (const issue of fieldIssues) {
        if (isFieldName(issue.path)) form.setError(issue.path, { message: issue.message })
      }
      return fieldIssues.length > 0
    }
    if (error.status === 409) {
      const { field, message } = error.body as ConflictBody
      if (field && isFieldName(field)) {
        form.setError(field, { message: message ?? 'Already taken' })
        return true
      }
    }
    return false
  }

  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate>
        <Card className="max-w-3xl">
          <CardContent className="grid gap-6">
            <div className="grid gap-6 sm:grid-cols-[12rem_1fr]">
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input {...field} className="font-mono uppercase" autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={() => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      {...form.register('description', { setValueAs: emptyToNull })}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-6 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="price"
                render={() => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="font-mono"
                        {...form.register('price', { setValueAs: numberOrUndefined })}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stock"
                render={() => (
                  <FormItem>
                    <FormLabel>Stock</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        className="font-mono"
                        {...form.register('stock', { setValueAs: numberOrUndefined })}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weightKg"
                render={() => (
                  <FormItem>
                    <FormLabel>Weight (kg)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        className="font-mono"
                        {...form.register('weightKg', { setValueAs: numberOrNull })}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="category"
              render={() => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input
                      list="category-names"
                      autoComplete="off"
                      {...form.register('category', { setValueAs: emptyToNull })}
                    />
                  </FormControl>
                  <datalist id="category-names">
                    {categories.data?.map((category) => (
                      <option key={category.id} value={category.name} />
                    ))}
                  </datalist>
                  <FormMessage />
                </FormItem>
              )}
            />
            {errors.root && <p role="alert">{errors.root.message}</p>}
          </CardContent>
          <CardFooter className="gap-2">
            <Button asChild variant="outline">
              <Link href="/products">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting} className="ml-auto">
              {isSubmitting ? 'Saving…' : submitLabel}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  )
}
