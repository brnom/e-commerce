# <img src="apps/web/src/app/icon.svg" alt="" width="24" height="24"> E-commerce

A small e-commerce platform: a product catalog with search, bulk import from CSV, and a purchase flow with a simulated payment provider. The repository is a monorepo with a Python API (FastAPI), a Next.js web app and PostgreSQL. One `docker compose up` runs it end to end.

This repository was built for a technical assessment. The functional brief asked for product CRUD, CSV import, search, purchase with a fake payment, a UI for all of it, Docker and a local DB. This repository treats that brief as the product requirements of a real system. [Decisions](#decisions) and the `openspec/` directory record the reasoning behind each decision.

## Demo

Both recordings show the web app on `localhost:3005` and the API on `localhost:5001`.

**Catalog — search, filter and create a product.** A search with no match shows the empty state. The category select filters the list. A row opens the product page. The form then creates the product that was missing.

![Browsing, filtering and creating a product](docs/demo-catalog.gif)

**CSV import and purchase.** The recording imports `data/e-commerce_input.csv` and shows its per-row report. Each failed row names the field and the reason. Then a product goes into the cart, and the one-click checkout places a paid order.

![Importing a CSV and placing an order](docs/demo-import-purchase.gif)

## Prerequisites

- Docker Desktop (or Docker Engine 24+ with the Compose plugin) to run the stack.
- For local development, also:
  - Node 26 and pnpm 10 for the web app and the shared package.
  - Python 3.14 with [uv](https://docs.astral.sh/uv/) for the API. If Python 3.14 is missing, uv fetches it.

## Run with Docker

```bash
docker compose up --build
```

Then open:

- Web app: http://localhost:3005
- API health: http://localhost:5001/health

The API applies pending database migrations before it starts listening. The database keeps its data in the `pgdata` volume across restarts. To start from an empty database, run `docker compose down -v`.

**The catalog starts empty.** To fill the store, load the 97-row sample file (downloaded on **2026-09-17**):

```bash
curl -F file=@data/e-commerce_input.csv http://localhost:5001/imports
```

You can also upload the same file at http://localhost:3005/imports.

## Run for development

```bash
pnpm install
docker compose up db -d
cp .env.example .env
pnpm db:migrate
pnpm dev
```

`pnpm dev` starts the API on port 5001 with hot reload and the web app on port 3005. Run `pnpm db:migrate` again after you pull a new migration.

The API's integration tests use a real PostgreSQL database, `ecommerce_test`, on the same `db` container. Each test run recreates that database, so `docker compose up db -d` is the only prerequisite for `pnpm test`.

## Quality gate

```bash
pnpm check
```

This command runs lint, type checks and tests in every workspace, and a Prettier check. CI runs the same command on every push and pull request, and also builds both Docker images.

Three lint rules shape the code:

- **No comments in source files.** Intent belongs in names, types, tests and this document. ESLint enforces the rule in TypeScript, and `apps/api/scripts/check_sources.py` enforces it in Python.
- **Layer boundaries in the API.** `domain/` imports no framework and no other layer. `application/` does not import `infra/`, FastAPI or SQLAlchemy. Import-linter enforces these boundaries.
- **Strict, text-only web app.** TypeScript runs in `strict` mode with `noUncheckedIndexedAccess`, and ESLint rejects `dangerouslySetInnerHTML`, so product data always renders as escaped text.

## Repository layout

```
apps/
  api/                  Python REST API (FastAPI), managed with uv
    src/ecommerce_api/
      domain/           entities, value objects, domain errors (plain Python)
      application/      ports (Protocols), use cases, Pydantic input models
      infra/            FastAPI app, routers, error handlers, SQLAlchemy Core repositories, fake payment gateway, env config
      __main__.py       entry point: reads the environment and runs uvicorn
    migrations/         Alembic revisions, each running one SQL file from migrations/sql/
    scripts/            check_sources.py, the no-comments rule for Python
    tests/              pytest: unit/ with in-memory fakes, integration/ against PostgreSQL
  web/                  Next.js App Router application, client-side rendered
    src/app/            routes: /, /products, /imports, /cart, /checkout, /orders and their detail pages, globals.css tokens
    src/components/
      ui/               shadcn/ui components (generated, then owned)
      layout/           header, footer, page header
      products/         table, filters, form, detail page, delete dialog, states
      imports/          upload card, import history, per-row report
      cart/             add-to-cart button, header cart link, cart page, checkout page
      orders/           order history, order page, status badge
    src/lib/            API client, typed product/import/order endpoints, URL state for the list, browser cart store, fonts
    src/fonts/          vendored Archivo (display), Geist comes from the `geist` package
packages/
  shared/               zod schemas and TypeScript types used by the web app, validation-cases/ run by both test suites
data/                   sample product CSV used by the import's integration test
docs/                   demo recordings used by this file
openspec/               change proposals, designs, specs and task lists (spec-driven workflow)
docker-compose.yml      db + api + web
```

## API

Every endpoint is JSON over HTTP, unauthenticated, on `http://localhost:5001` by default. A validation failure answers `400` with one entry per failing field. An unknown id answers `404`, and a conflict answers `409`.

You can browse and call the whole contract at [`/docs`](http://localhost:5001/docs), which FastAPI generates from the routes and their Pydantic models.

| Method   | Path            | Purpose                                                                                 |
| -------- | --------------- | --------------------------------------------------------------------------------------- |
| `GET`    | `/health`       | Liveness plus a database check.                                                         |
| `GET`    | `/products`     | Paginated list. Query: `q` (text search), `category`, `sort`, `order`, `page`, `limit`. |
| `POST`   | `/products`     | Creates a product. Answers `409` when another product uses the SKU, even a deleted one. |
| `GET`    | `/products/:id` | One product.                                                                            |
| `PATCH`  | `/products/:id` | Partial update, with the same field rules as the create.                                |
| `DELETE` | `/products/:id` | Soft delete.                                                                            |
| `GET`    | `/categories`   | Every category, ordered by name.                                                        |
| `POST`   | `/imports`      | `multipart/form-data` with a `file` field. See [CSV import](#csv-import).               |
| `GET`    | `/imports`      | Job summaries, newest first.                                                            |
| `GET`    | `/imports/:id`  | One job with the full per-row report.                                                   |
| `POST`   | `/orders`       | Places an order. See [Purchase](#purchase).                                             |
| `GET`    | `/orders`       | Order summaries, newest first.                                                          |
| `GET`    | `/orders/:id`   | One order with its lines, total, status and the card's last four digits.                |

## Decisions

We planned each change with OpenSpec before we built it. A change has a proposal, a design with the alternatives we weighed, a spec delta with testable scenarios, and a task list. The merged behavior contract is in `openspec/specs/`. For the full reasoning, read each change's design: [`scaffold-monorepo`](openspec/changes/archive/2026-09-20-scaffold-monorepo/design.md), [`products-crud-search`](openspec/changes/archive/2026-09-21-products-crud-search/design.md), [`web-design-system`](openspec/changes/archive/2026-09-21-web-design-system/design.md), [`csv-import`](openspec/changes/archive/2026-09-21-csv-import/design.md), [`purchase`](openspec/changes/archive/2026-09-22-purchase/design.md), [`purchase-ux`](openspec/changes/archive/2026-09-22-purchase-ux/design.md) and [`migrate-api-to-python`](openspec/changes/archive/2026-09-22-migrate-api-to-python/design.md).

**Foundation**

- **Separate API and web app.** The API owns the database. The web app is client-side rendered and calls the API over HTTP.
- **PostgreSQL with SQLAlchemy Core, not an ORM.** The statements that matter stay visible in the code: the conditional stock `UPDATE`, `INSERT … ON CONFLICT` and the escaped `ILIKE`.
- **Hexagonal layout.** Business rules are plain Python. FastAPI and SQLAlchemy appear only in `infra/`.
- **The same validation rules on both sides.** The web app validates with zod, and the API validates with Pydantic models that reproduce the same rules and messages. Both test suites run the cases in `packages/shared/validation-cases/`, so a rule that changes on one side only fails the other side's tests.
- **Migrations run before the API starts.** A fresh `docker compose up` needs no extra step, and a failed migration stops the API.

**Product catalog**

- **Categories are created on demand.** A case-insensitive name makes `Electronics` and `electronics` one category.
- **Soft delete with a reserved SKU.** A deleted product disappears from every read, but its row stays, so past orders still resolve. Its SKU stays taken.
- **Search is `ILIKE` with a trigram index.** It matches a case-insensitive substring of the name or the description.
- **Integration tests use a real PostgreSQL.** Wildcard escaping, category reuse and soft-delete filtering are SQL behaviors, so a mock would test only the mock.
- **The list page keeps its state in the URL.** A filtered list survives a refresh and can be shared.

**Web design**

- **Tailwind CSS and shadcn/ui.** shadcn copies each component into the repository, where we own and lint it.
- **Black, white and one gray, with no images.** Typography carries the design, and every figure uses a monospace font so that columns align.
- **Every data view has a loading, empty, error and not-found state.**

**CSV import**

- **Partial import with a per-row report.** The import writes the valid rows and reports each invalid row with its line, field and message.
- **Upsert by SKU.** A known SKU updates the product, and an unknown SKU creates one, so a second import never duplicates a product.
- **Absent columns keep stored values.** A file with only `sku,price,stock` updates prices and keeps descriptions.
- **One transaction per file.** The import writes the products and records the job together.

**Purchase**

- **Reserve, charge, settle.** The API reserves stock with a conditional `UPDATE … WHERE stock >= quantity`, which makes overselling impossible. It then calls the payment provider outside any transaction. If the payment fails, the stock goes back.
- **One short item rejects the whole order.** The API lists every problem item, and the checkout page corrects the cart.
- **A declined payment is an outcome, not an error.** The API creates the order in both cases, and `status` carries the result.
- **The fake payment provider is deterministic.** Known test cards give known outcomes, so tests and demos are reproducible.
- **Order lines are a snapshot.** A later price change or deletion never rewrites an order.
- **The cart lives in the browser.** The API prices every order from the catalog, never from the cart.

## CSV import

Upload a file at `/imports`, or run `curl -F file=@data/e-commerce_input.csv http://localhost:5001/imports`. The response is the job with one entry per data row.

| Column        | Required | Rule                                                                  |
| ------------- | -------- | --------------------------------------------------------------------- |
| `name`        | yes      | 1–200 characters after trimming                                       |
| `sku`         | yes      | 1–64 characters, stored upper-cased, matched case-insensitively       |
| `price`       | yes      | plain decimal, `.` separator, at most two fraction digits, no symbols |
| `stock`       | yes      | non-negative integer                                                  |
| `description` | no       | at most 2000 characters                                               |
| `category`    | no       | created on demand, matched case-insensitively                         |
| `weight_kg`   | no       | plain decimal, at most three fraction digits                          |

The file is UTF-8, comma-separated, with a header row. Limits: 2 MB and 5,000 data rows per file. Each row ends as `created`, `updated`, `skipped` (blank line) or `failed` (with issues).

The sample file imports as **87 created, 2 skipped, 8 failed**. A second import gives 87 updated.

## Purchase

Add products to the cart, review it at `/cart`, and pay at `/checkout`. The checkout opens with a sample customer and the approving test card, so one click places a paid order. Orders appear at `/orders`.

The payment provider is simulated. `4000 0000 0000 0002` is declined, `4000 0000 0000 9995` is declined for insufficient funds, and any other number that passes the Luhn check, such as `4242 4242 4242 4242`, is approved.

`POST /orders` takes `{ items: [{ productId, quantity }], customer: { name, email }, card: { cardholderName, cardNumber, expiry, cvc } }`. It answers:

- `201` with the order in status `paid` or `payment_failed`.
- `400` with per-field issues.
- `409` with every item that is short of stock or unavailable.

## Security and scope

This is a demonstration system, and it is open on purpose: **there is no authentication, no authorization and no rate limiting**. Anyone who can reach the API can read and write the catalog, import a file and place an order. Run it locally. Do not expose it to a network.

The code does defend these points:

- **CORS allows exactly one origin**, `WEB_ORIGIN`.
- **Every input is validated twice**, by zod in the browser and by Pydantic in the API. An error never returns a stack trace.
- **Uploads are bounded.** The API parses a CSV in memory and never writes it to disk.
- **User-supplied text is rendered as text**, so React escapes any markup in a product name.
- **SQLAlchemy parameterizes every query.**
- **No card data is stored.** The order keeps only the last four digits.
- **Both containers run as unprivileged users.**

Out of scope: accounts and roles (an auth layer and an owner on every write), rate limiting (tighter on `/imports` and `/orders`), observability (structured logs, traces, metrics), a real payment provider (webhooks, idempotency keys, a sweeper for `pending` orders), and refunds, shipping and tax, which the domain does not model.

Dependabot and CodeQL watch the dependencies and the code.

## Status

All seven OpenSpec changes listed in [Decisions](#decisions) are archived. Smaller changes with no new behavior shipped as plain pull requests.

## License

[Apache License 2.0](LICENSE). The sample CSV under `data/` is test data, not product data.
