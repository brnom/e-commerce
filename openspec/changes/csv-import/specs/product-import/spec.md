# Spec Delta

## Purpose

Defines how products are loaded in bulk from a CSV file: the accepted file format, how each row is validated and matched to the catalog, what is written and what is refused, and the report that records every import so it can be reviewed later.

## ADDED Requirements

### Requirement: Accepted file format
The system SHALL accept a comma-separated UTF-8 text file (a leading byte-order mark is tolerated) whose first line is a header. Header names SHALL be matched case-insensitively after trimming. The columns `name`, `sku`, `price` and `stock` SHALL be required; `description`, `category` and `weight_kg` SHALL be optional; any other column SHALL be ignored. A file that is not well-formed CSV, lacks a required column, or has no data rows SHALL be rejected with status `400` and a message naming the problem (including every missing column), and no product SHALL be written and no import SHALL be recorded. A file larger than 2 MB SHALL be rejected with status `413`; a file with more than 5,000 data rows SHALL be rejected with status `400`.

#### Scenario: Missing required columns
- **WHEN** a file is uploaded whose header is `name,description,category`
- **THEN** the response is `400`, the message names `sku`, `price` and `stock` as missing, and the import history is unchanged

#### Scenario: Quoted fields containing commas
- **WHEN** a row has the description `"Single origin, medium roast, 1kg bag"`
- **THEN** the row is imported with that description intact, comma included

#### Scenario: Header in a different case with extra columns
- **WHEN** the header is `SKU,Name,Price,Stock,Weight_kg,Supplier`
- **THEN** the file is accepted, `Supplier` is ignored, and `Weight_kg` is read as the weight column

#### Scenario: Malformed CSV
- **WHEN** the uploaded file has an unterminated quoted field
- **THEN** the response is `400` and nothing is imported

### Requirement: Row validation and outcomes
Each data row SHALL receive exactly one outcome: `created`, `updated`, `skipped` or `failed`. A row whose every cell is blank SHALL be `skipped`. A row SHALL be `failed` when any field violates the product validation rules of the catalog, and the report SHALL list every failing field with a message. Numeric cells (`price`, `stock`, `weight_kg`) SHALL be accepted only as plain decimal numbers using `.` as the decimal separator: currency symbols, thousands separators, words and blanks in a required numeric cell are validation failures. Blank optional cells SHALL be read as absent. Rows SHALL be numbered by their line in the file, with the header as line 1. Failed and skipped rows SHALL NOT prevent valid rows from being imported.

#### Scenario: Price with a currency symbol
- **WHEN** a row has `price` `$29.99`
- **THEN** the row is `failed` with an issue on `price`, and the other valid rows of the file are imported

#### Scenario: Word instead of a number
- **WHEN** a row has `price` `free`
- **THEN** the row is `failed` with an issue on `price`

#### Scenario: Negative stock
- **WHEN** a row has `stock` `-5`
- **THEN** the row is `failed` with an issue on `stock`

#### Scenario: Blank or whitespace name
- **WHEN** a row has a `name` that is empty or only whitespace and a valid SKU
- **THEN** the row is `failed` with an issue on `name`

#### Scenario: Entirely blank row
- **WHEN** a row consists only of separators (`,,,,,,`)
- **THEN** the row is `skipped` and no issue is reported

#### Scenario: Blank optional cells
- **WHEN** a row has empty `description`, `category` and `weight_kg` cells and valid required cells
- **THEN** the row is imported with `description`, `category` and `weightKg` `null`

#### Scenario: Several issues on one row
- **WHEN** a row has a blank `name` and `stock` `-5`
- **THEN** the row is `failed` and the report lists one issue for `name` and one for `stock`

### Requirement: Matching rows to products by SKU
SKUs SHALL be compared after trimming and case-insensitively, as the catalog does. A valid row whose SKU is not in the catalog SHALL create a product (`created`). A valid row whose SKU belongs to an existing product SHALL update that product (`updated`), including a product that was previously deleted, which SHALL become visible again. On an update, every column present in the file SHALL overwrite the stored value, a blank optional cell SHALL clear the stored value, and a field whose column is absent from the file SHALL be left unchanged. A category name SHALL be resolved with the catalog's find-or-create rule. When the same SKU appears more than once in a file, the first occurrence SHALL be processed and every later occurrence SHALL be `failed` with an issue on `sku` naming the earlier row.

#### Scenario: New SKU creates a product
- **WHEN** no product has SKU `RS-001` and a valid row with `sku` `rs-001` is imported
- **THEN** the row is `created` and the catalog lists a product with SKU `RS-001`

#### Scenario: Known SKU updates the product
- **WHEN** a product with SKU `CB-010` exists with price `18.75` and a valid row with `sku` `CB-010` and `price` `19.50` is imported
- **THEN** the row is `updated`, the product's price is `19.50` and its `id` is unchanged

#### Scenario: Deleted product is restored
- **WHEN** a product with SKU `WM-042` was deleted and a valid row with `sku` `WM-042` is imported
- **THEN** the row is `updated` and `GET /products/{id}` for that product responds `200` again

#### Scenario: Duplicate SKU inside the file
- **WHEN** rows on lines 2 and 36 both have `sku` `RS-001`
- **THEN** line 2 is imported, line 36 is `failed` with an issue on `sku` that names line 2, and the product keeps the values from line 2

#### Scenario: New category created from the file
- **WHEN** no category named `Stationery` exists and a row with `category` `Stationery` is imported
- **THEN** the product is linked to a category named `Stationery` and `GET /categories` includes it once, even if several rows use it

#### Scenario: Re-importing the same file
- **WHEN** a file whose valid rows were all imported is uploaded again unchanged
- **THEN** every row that was `created` is now `updated`, no product is duplicated, and the failed and skipped counts are the same as the first time

### Requirement: Import job and report
Every accepted file SHALL be recorded as an import job with a generated `id`, the uploaded `fileName`, `createdAt`, the totals `rows`, `created`, `updated`, `skipped` and `failed`, and a row report listing for every data row its line number, `sku`, `name`, outcome and issues. The system SHALL expose `POST /imports` (multipart upload with the file in the `file` field, responding `201` with the job and its row report), `GET /imports` (every job newest first, without row reports) and `GET /imports/{id}` (the job with its row report; `404` for an unknown id). Writing the valid rows and recording the job SHALL be a single unit: if any write fails, no product is changed and no job is recorded.

#### Scenario: Report totals add up
- **WHEN** a file with 97 data rows is imported of which 2 are blank, 8 fail and the rest are new
- **THEN** the response is `201` with totals `rows` `97`, `created` `87`, `updated` `0`, `skipped` `2`, `failed` `8`, and the report has 97 row entries

#### Scenario: Job can be fetched later
- **WHEN** `GET /imports/{id}` is requested with the `id` returned by an earlier upload
- **THEN** the response is `200` with the same totals and row report as the upload response

#### Scenario: History lists jobs newest first
- **WHEN** two files have been imported
- **THEN** `GET /imports` returns both with their totals, the most recent first, and no row report

#### Scenario: Unknown job
- **WHEN** `GET /imports/{id}` is requested with an id that was never created
- **THEN** the response is `404`

### Requirement: Import user interface
The web application SHALL provide an imports page where a user chooses a `.csv` file and starts the import, sees the import history with each job's file name, date and totals, and can open any job's report. After an upload completes the report page for that job SHALL open, showing the totals and a table with every row's line number, SKU, name, outcome and issues, with a control to show only rows that were not imported. A rejected file SHALL show the API's message on the imports page. The products list SHALL reflect the imported products the next time it is shown.

#### Scenario: Upload leads to the report
- **WHEN** a user picks a CSV file on the imports page and starts the import
- **THEN** the report page for the new job opens, showing its totals and one line per row of the file

#### Scenario: Problem rows can be isolated
- **WHEN** a user enables the problems-only control on a report page
- **THEN** only `failed` and `skipped` rows remain visible, each `failed` row showing its issues

#### Scenario: Rejected file is explained
- **WHEN** a user uploads a file with a missing required column
- **THEN** the imports page shows the message naming the missing columns and the history is unchanged

#### Scenario: Imported products appear in the catalog
- **WHEN** an import that created products completes and the user opens the products page
- **THEN** the created products are listed
