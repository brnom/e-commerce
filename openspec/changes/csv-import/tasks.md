# Tasks

## 1. Sample data and shared schemas

- [x] 1.1 Move `e-commerce_input.csv` to `data/e-commerce_input.csv` with `git mv`-equivalent (untracked file: move, then add) and verify `git status` shows it under `data/`
- [x] 1.2 Add `packages/shared/src/import/import.schema.ts` with `importRowSchema` (cell coercion over `createProductSchema`, `weight_kg` → `weightKg`), `importRowReportSchema`, `importJobSchema`, `importJobSummarySchema` and inferred types; export from `index.ts`; verify `import.schema.test.ts` covers `$29.99`, `free`, `-5`, blank name, blank optional cells, absent columns, and passes with `pnpm --filter @ecommerce/shared test`
- [x] 1.3 Rebuild shared (`pnpm --filter @ecommerce/shared build`) and verify `pnpm --filter api typecheck` still passes

## 2. Database

- [ ] 2.1 Add the `ImportJob` model to `apps/api/prisma/schema.prisma` and create migration `import_jobs` with `prisma migrate dev`; verify the migration SQL creates the table with the seven columns plus `rows` JSON and `createdAt`
- [ ] 2.2 Regenerate the Prisma client and verify `pnpm --filter api typecheck` passes

## 3. API domain and application layers

- [ ] 3.1 Add `domain/import/import-job.ts` (`ImportJob`, `ImportJobSummary`, `ImportRowReport`, `ImportOutcome`) and `InvalidImportFileError` to `domain/shared/domain-error.ts`; verify typecheck
- [ ] 3.2 Add `csv-parse` to the API and implement `application/imports/parse-csv.ts` (BOM, header normalization, required/optional columns, ragged lines as blank cells, record start line); verify `parse-csv.test.ts` covers quoted commas, header case with extra columns, missing columns error listing every missing name, unterminated quote error, blank lines kept, and the 97-row sample file parsing to 97 records
- [ ] 3.3 Add `application/ports/import-job-repository.ts` (`ImportPlan`, `ProductUpsert`, `ImportJobRepository`, `IMPORT_JOB_REPOSITORY`) and `__fakes__/in-memory-import-job-repository.ts` that applies upserts against the in-memory product and category fakes; verify typecheck
- [ ] 3.4 Implement `ImportProducts` (parse → validate rows → first-wins SKU dedupe → plan → `commit`), `ListImportJobs` and `GetImportJob` (404 via `NotFoundError`); verify `imports.test.ts` with the fakes asserts outcomes and totals for a small inline CSV (created/updated/skipped/failed, duplicate line reference, restore of a deleted product, absent column left unchanged on update, file-level errors thrown)

## 4. API infrastructure

- [ ] 4.1 Extract the category upsert into `infra/persistence/prisma/category-upsert.ts` taking a transaction client, reuse it in `PrismaCategoryRepository`, and implement `PrismaImportJobRepository.commit` as one interactive transaction (existing SKU lookup, category upsert, `product.upsert` on `sku` with `deletedAt: null` on update, `importJob.create`) plus `findById` / `findAll` (newest first, no `rows`); verify `prisma-import-job.repository.integration.test.ts` covers create vs updated outcomes, restore, absent-field preservation, and rollback when a write fails
- [ ] 4.2 Add `@types/multer`, `ImportsController` (`POST /imports` with `FileInterceptor('file')`, memory storage, 2 MB limit, `201`; `GET /imports`; `GET /imports/:id` with `ImportJobIdPipe`) and `ImportsModule`; map `InvalidImportFileError` to `400 { message, missingColumns }` in `DomainExceptionFilter`; register the module in `app.module.ts`; verify `imports.integration.test.ts` uploads `data/e-commerce_input.csv` → `201` with totals `97 / 87 / 0 / 2 / 8`, uploads it again → `0 / 87 / 2 / 8`, deletes a product and re-imports → `200` on its detail, `GET /imports` newest first without `rows`, `GET /imports/:id` equals the upload response, unknown id → `404`, missing columns → `400`, no data rows → `400`, > 2 MB → `413`, > 5,000 rows → `400`
- [ ] 4.3 Run `pnpm --filter api test` and `pnpm --filter api lint` and verify both pass

## 5. Web

- [ ] 5.1 Add `apiUpload` to `src/lib/api-client.ts` (no JSON content type) with a unit test, and `src/lib/imports-api.ts` (`uploadImport`, `listImports`, `getImport`, `importKeys`); verify typecheck
- [ ] 5.2 Add `/imports` (`ImportsPage`: upload card with file input and `Import` button, API message alert on `400`/`413`, history table with skeleton/empty/error states, invalidation of import, product and category queries, navigation to the report on success); verify `imports-page.test.tsx` covers the multipart POST and navigation, the rejected-file message, and the history rendering
- [ ] 5.3 Add `/imports/[id]` (`ImportReportPage`: heading, totals grid, `Problems only` toggle with `aria-pressed`, rows table with outcome badges and issues, not-found state); verify `import-report-page.test.tsx` covers the totals, the filter hiding `created`/`updated` rows, and the not-found state
- [ ] 5.4 Add the `Imports` link to `SiteHeader`; verify the header test (or a new one) asserts both `Products` and `Imports` links render
- [ ] 5.5 Run `pnpm --filter web test`, `pnpm --filter web lint` and `pnpm --filter web typecheck` and verify all pass

## 6. Docs and final check

- [ ] 6.1 Update `README.md`: file format and column table, the outcome rules (first-wins duplicates, restore on import, absent columns), the `data/e-commerce_input.csv` expected result (`87 created / 2 skipped / 8 failed`), the new endpoints and pages, a "CSV import" entry in Decisions linking to this design, and the Status table row for `csv-import`; verify the links resolve
- [ ] 6.2 Run `pnpm check` at the root and verify every task is green
- [ ] 6.3 Run `docker compose up --build` from a clean volume, import `data/e-commerce_input.csv` through the UI, and verify the report shows `87 / 0 / 2 / 8`, the products page lists the imported products, and `/imports` shows the job in the history
