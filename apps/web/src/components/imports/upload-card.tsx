'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api-client'
import { importKeys, uploadImport } from '@/lib/imports-api'
import { categoryKeys, productKeys } from '@/lib/products-api'

type RejectedBody = { message?: string }

function describeError(error: unknown): string {
  if (error instanceof ApiError && (error.status === 400 || error.status === 413)) {
    const message = (error.body as RejectedBody | null)?.message
    if (message) return message
    if (error.status === 413) return 'The file is larger than 2 MB.'
  }
  return 'The file could not be imported. Try again.'
}

export function UploadCard() {
  const inputId = useId()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const mutation = useMutation({
    mutationFn: uploadImport,
    onSuccess: async (job) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: importKeys.all }),
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
        queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
      ])
      router.push(`/imports/${job.id}`)
    },
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (file) mutation.mutate(file)
      }}
    >
      <Card>
        <CardContent className="grid gap-3">
          <Label htmlFor={inputId}>CSV file</Label>
          <Input
            id={inputId}
            type="file"
            accept=".csv,text/csv"
            disabled={mutation.isPending}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null)
              mutation.reset()
            }}
          />
          <p className="text-sm text-muted-foreground">
            Columns: <code className="font-mono">name, sku, price, stock</code> required;{' '}
            <code className="font-mono">description, category, weight_kg</code> optional. Rows are
            matched to existing products by SKU.
          </p>
          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {describeError(mutation.error)}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={!file || mutation.isPending} className="ml-auto">
            <Upload />
            {mutation.isPending ? 'Importing…' : 'Import'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
