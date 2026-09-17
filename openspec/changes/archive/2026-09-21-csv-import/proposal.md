# Proposal

## Why

Products enter the catalog one form at a time. A store starting out, or receiving a supplier's price list, needs to load hundreds of products at once from the CSV files those lists ship in — and those files are never clean: they carry currency symbols in prices, negative stock, blank names, repeated SKUs and stray empty lines. The import has to load what is good, refuse what is not, and say exactly which rows failed and why, so the file can be fixed and sent again without creating duplicates.

## What Changes

- Add a CSV import for products: a file is uploaded, every row is validated against the same rules the product form enforces, the valid rows are written to the catalog and a per-row report is returned. Invalid rows never block the valid ones.
- Rows are matched to existing products by SKU: a new SKU creates a product, a known SKU updates it (including a product that was soft-deleted, which comes back). The second occurrence of a SKU inside one file is rejected, so a file cannot silently overwrite itself.
- Categories in the file are created on demand, reusing the catalog's existing find-or-create rule.
- Every import is recorded as an import job with its summary and row report, so a past import can be reviewed after the fact and the history is visible.
- Add an `Imports` area to the web app: an upload page with the import history, and a report page per import listing each row's outcome. The global navigation gains an `Imports` link.
- Ship the sample product CSV under `data/` and use it as the fixture for the end-to-end import test.

## Capabilities

### New Capabilities

- `product-import`: bulk loading of products from a CSV file — the accepted file format, the per-row validation and outcome rules, SKU matching, the persisted import job with its report, and the pages that upload a file and show its report.

### Modified Capabilities

- `web-app-shell`: the "Global navigation" requirement gains the `Imports` link in the header.

_`product-catalog` is unchanged: import reuses its validation and category rules as they are. Bringing a soft-deleted product back through import does not alter the catalog's own rules — its SKU stays reserved for that product, and the catalog endpoints keep responding `404` for it until an import restores it._

## Impact

- **Database:** new migration creating `ImportJob` (summary counters plus the row report stored as JSON). No change to `Product` or `Category`.
- **API (`apps/api`):** new `application/imports` use cases and an `ImportJobRepository` port; the `ProductRepository` port gains an upsert-by-SKU operation; new `infra/http/imports` controller accepting a multipart upload; a CSV parsing dependency (`csv-parse`) and `@types/multer`.
- **Shared (`packages/shared`):** new `import` module with the row report and import job schemas, so the web app types the report from the same source.
- **Web (`apps/web`):** new routes `/imports` and `/imports/[id]`; the header gains an `Imports` link; the products list is refreshed after an import.
- **Repository:** `e-commerce_input.csv` moves to `data/e-commerce_input.csv`; README documents the file format and the import flow.
- **Later changes:** `purchase` is unaffected; it reads stock through the existing repository port.
