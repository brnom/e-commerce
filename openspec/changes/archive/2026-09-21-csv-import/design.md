# Design

## Context

See proposal.md — Why. The catalog exists with its validation in `packages/shared` (`createProductSchema`), a `ProductRepository` / `CategoryRepository` pair of ports, Prisma repositories and a hexagonal layout enforced by lint (`application/` cannot import `infra/`, Nest or Prisma). Product writes so far are single-row; the import is the first multi-row, multi-table write that has to be atomic, and the first endpoint that receives a file instead of JSON.

The sample file (`e-commerce_input.csv`, 97 data rows) is the reference for the dirty cases the import must handle: `$29.99` and `free` as prices, `-5` stock, an empty and a whitespace-only name, two fully blank lines, `RS-001` twice and `BS-021` three times, quoted descriptions containing commas, three empty categories and three empty weights.

## Goals / Non-Goals

**Goals:**

- One request does the whole job: upload, validate, write, report. The response is the report.
- The report is exact and reproducible: line numbers match the spreadsheet, every failed row says which field and why, and re-importing the same file yields the same failures and zero duplicates.
- Atomic writes: a file's valid rows and its job record land together or not at all, so the history never claims products that are not there.
- The validation messages are the ones the product form already shows, from the same shared schema.

**Non-Goals:**

- Background or resumable imports, progress streaming, or files beyond 2 MB / 5,000 rows. The synchronous path covers the supplier-price-list scale; a queue would be a separate change.
- Column mapping UI, delimiter detection, or Excel files.
- Undoing an import.
- Import of anything other than products.

## Decisions

### D1. Transport: multipart upload, file kept in memory

`POST /imports` accepts `multipart/form-data` with the file in the `file` field, through Nest's `FileInterceptor` with multer's memory storage and `limits.fileSize = 2 MB`. Nest maps multer's size error to `413` on its own, and the browser's `FormData` gives the original file name for free, which the report shows. The web client gets a second helper next to `apiClient` that does not set `Content-Type` (the browser must set the multipart boundary).

*Alternative:* a raw `text/csv` body. Simpler on the server, but the file name would travel in a header and the browser side would read the file into a string first; multipart is what a file input naturally produces.

### D2. Parsing lives in the application layer, with `csv-parse`

`application/imports/parse-csv.ts` wraps `csv-parse/sync` with `bom: true`, `relax_column_count: true` (a short line is read as blank cells, not a parse error), `skip_empty_lines: false` (blank lines must be reported as `skipped`, not vanish) and `info: true` so each record carries the physical line it starts on — the number the report shows. Header names are lower-cased and trimmed before mapping to the seven known columns; missing required columns and parser errors become an `InvalidImportFileError` (domain) that the exception filter renders as `400 { message, missingColumns? }`.

`csv-parse` is a dependency-free library, not a framework, so the layer rule allows it here and the parser is unit-testable without Nest.

### D3. Row validation reuses the product schema through a cell-coercion layer

`packages/shared` gains `import/import.schema.ts`:

- `importRowSchema`: a preprocess step turns each cell into what `createProductSchema` expects — blank optional cells become `undefined`, numeric cells matching `^-?\d+(\.\d+)?$` become numbers, anything else stays a string so the existing message ("Price must be a number") fires. `weight_kg` maps to `weightKg`. Absent columns are `undefined` and distinguished from blank cells by the parser output (`null` for a blank cell in a present column) so updates can leave absent fields untouched.
- `importRowReportSchema` (`line`, `sku`, `name`, `outcome`, `issues[]`), `importJobSchema` and `importJobSummarySchema` (the job without `rows`), used by the API response and the web pages.

Every row is validated up front; the report entries for `failed` and `skipped` rows are final before anything touches the database.

### D4. In-file duplicates: first occurrence wins

After validation, the use case walks the valid rows in file order keeping a `Map<normalizedSku, line>`; a later row with a seen SKU becomes `failed` with `sku: "Duplicate of line N"`. First-wins is predictable when reading the file top to bottom and matches how a person would spot the problem; last-wins would let a stray copy at the bottom silently overwrite a deliberate row.

### D5. One port method owns the transaction

`application/ports/import-job-repository.ts`:

```ts
interface ImportPlan {
  fileName: string
  rows: ImportRowReport[]         // failed and skipped final; valid rows carry outcome "pending"
  writes: ProductUpsert[]         // one per valid, non-duplicate row, in file order
}
interface ImportJobRepository {
  commit(plan: ImportPlan): Promise<ImportJob>
  findById(id: string): Promise<ImportJob | null>
  findAll(): Promise<ImportJobSummary[]>
}
```

`PrismaImportJobRepository.commit` runs one interactive transaction (`timeout: 60_000`): select the existing SKUs among the writes (deleted included) to decide `created` vs `updated`; for each write, resolve the category with the same upsert `PrismaCategoryRepository` uses (extracted to a helper taking the transaction client), then `product.upsert` on `sku` — `create` with nulls for absent fields, `update` with only the present fields plus `deletedAt: null`, which is what restores a deleted product; finally `importJob.create` with the counters and the finalized `rows`. The use case receives the persisted job and returns it.

*Alternative:* a `UnitOfWork` port with transaction-aware `ProductRepository` / `CategoryRepository` methods. More general, but it would push a transaction handle through every port signature for the sake of one caller. The `purchase` change has the same shape (reserve stock and record an order together) and will get its own single-method port; if a third case appears, generalize then.

### D6. `ImportJob` model

```
model ImportJob {
  id           String   @id @default(uuid(7)) @db.Uuid
  fileName     String
  totalRows    Int
  createdCount Int
  updatedCount Int
  skippedCount Int
  failedCount  Int
  rows         Json
  createdAt    DateTime @default(now()) @db.Timestamptz()
}
```

The row report is a JSON column rather than a child table: it is written once, read back whole, never queried by field, and capped at 5,000 entries (well under 1 MB). `GET /imports` selects everything but `rows`.

### D7. API layout

```
apps/api/src/
  domain/import/import-job.ts            ImportJob, ImportJobSummary, ImportRowReport types
  domain/shared/domain-error.ts          + InvalidImportFileError
  application/ports/import-job-repository.ts
  application/imports/parse-csv.ts       csv-parse wrapper -> { columns, records }
  application/imports/import-products.ts ImportProducts use case
  application/imports/list-import-jobs.ts, get-import-job.ts
  application/imports/__fakes__/in-memory-import-job-repository.ts
  infra/persistence/prisma/prisma-import-job.repository.ts, category-upsert.ts
  infra/http/imports/imports.controller.ts, imports.module.ts, import-job-id.pipe.ts
```

Same provider style as `ProductsModule` (`useFactory` for use cases). `ImportsController` has `POST /imports` (`FileInterceptor('file')`, `201`), `GET /imports`, `GET /imports/:id` (uuid pipe → `404` on malformed ids, like products).

### D8. Web

- `src/lib/imports-api.ts` (`uploadImport(file)`, `listImports()`, `getImport(id)`, `importKeys`) and an `apiUpload` helper in `api-client.ts`.
- `/imports` → `ImportsPage`: a `Card` with a file input (`accept=".csv,text/csv"`), the chosen file name, and an `Import` button; the mutation posts `FormData`, on success invalidates `importKeys.all`, `productKeys.all` and the categories query, then navigates to `/imports/[id]`. A `400`/`413` shows the API message in an alert. Below it, the history `Table` (file, date, created / updated / failed / skipped in mono) with each row linking to its report; skeleton, empty and error states as on the products page.
- `/imports/[id]` → `ImportReportPage`: the file name as the display heading, the totals as the spec-sheet grid used on the product detail page, a `Problems only` toggle button (`aria-pressed`), and the row `Table` with line, SKU, name, outcome `Badge` and issues rendered as `field — message` lines. Not-found state for unknown ids.
- `SiteHeader` links: `Products`, `Imports`. The home page tagline stays.

### D9. Tests

- Unit (`application/imports/*.test.ts`): parser (BOM, quoted commas, ragged lines, header case, missing columns, unterminated quote), row coercion, duplicate handling and outcome counting with the in-memory fake.
- Integration (`test/imports.integration.test.ts`): `supertest` `.attach('file', 'data/e-commerce_input.csv')` → `201` with `87 / 0 / 2 / 8`; second upload → `0 / 87 / 2 / 8`; delete a product then re-import → restored; `GET /imports` order; missing column → `400`; oversize → `413`. The sample file is the fixture, so the repository documents its own expected outcome.
- Web (`imports-page.test.tsx`, `import-report-page.test.tsx`): upload posts multipart and navigates; rejected file shows the message; problems-only filter.

## Risks / Trade-offs

- [5,000 sequential upserts could approach the transaction timeout on a slow database] → explicit 60 s timeout and the row cap; the integration test times the 97-row file as a smoke check. Batching by `createMany`/`updateMany` is the next step if it ever matters.
- [Line numbers drift when a quoted field spans lines] → the parser reports the line each record starts on; the spec ties row numbers to that.
- [Restoring a deleted product through import may surprise someone who deleted it on purpose] → the outcome is reported as `updated` on a row the user uploaded by SKU; the alternative (rejecting the row) would make a deleted SKU permanently un-importable.
- [Multer memory storage keeps the whole file in RAM] → 2 MB cap; requests are sequential per user in practice.
- [`nest start --watch` does not rebuild `packages/shared`] → already documented in the README; the tasks include the rebuild step.

## Migration Plan

Additive migration creating `ImportJob`; applied by the existing `prisma migrate deploy` on startup. Rollback is dropping the table; no existing data is touched.

## Open Questions

- Whether the import history needs pagination. Deferred: a `GET /imports` page holds every job without `rows`, which stays small for a long time; the products list pagination pattern can be lifted when it is needed.
