# Tasks

## 1. Tailwind and shadcn setup

- [x] 1.1 Add `tailwindcss`, `@tailwindcss/postcss`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `radix-ui`, `geist` to `apps/web` and `prettier-plugin-tailwindcss` to the root; add `apps/web/postcss.config.mjs`, `components.json` (style `new-york`, base `neutral`, CSS variables, alias `@/components`), `src/lib/utils.ts` (`cn`), and the plugin in `.prettierrc`; verify `pnpm --filter web build` succeeds with `@import "tailwindcss"` in `globals.css`
- [x] 1.2 Generate `button`, `input`, `textarea`, `label`, `select`, `table`, `form`, `alert-dialog`, `badge`, `card`, `skeleton`, `separator`, `pagination` into `src/components/ui/` with the shadcn CLI, run `eslint --fix`, remove any emitted comment; verify `pnpm --filter web lint` and `typecheck` pass with the generated files
- [x] 1.3 Vendor `Archivo-Variable.woff2` (+ OFL license) under `src/fonts/`, add `src/lib/fonts.ts` exposing `--font-display` (Archivo, `next/font/local`), `--font-sans` and `--font-mono` (Geist), and rewrite `globals.css` with the black/white token values (D2), the `@theme` font mappings and base styles; verify the home page renders with the three families (computed `font-family` in the browser) and `pnpm format:check` passes

## 2. Application shell

- [x] 2.1 Add `src/components/layout/site-header.tsx` (wordmark link, `Products` nav link, `ApiHealth` restyled as a mono badge keeping `data-testid="api-health"`) and `site-footer.tsx`; wrap pages in `app/layout.tsx` with the font classes and a `max-w-6xl` container; verify every route shows the header and `api-health.test.tsx` still passes
- [x] 2.2 Rewrite `app/page.tsx` as the landing (display headline, one line of copy, primary `Button` link to `/products`); verify the link navigates to the products page in the browser

## 3. Product list

- [x] 3.1 Restyle `products-page.tsx`, `product-filters.tsx`, `products-table.tsx` and `pagination.tsx` on the ui components per D5 (page header with mono count, `Input` + `Select` filters, table with mono SKU, name `Link` to `/products/{id}`, `Badge` category, right-aligned figures, `aria-sort` header buttons, shadcn `Pagination`); verify with `pnpm dev` that search still updates `?q=`, category filtering and sorting work, and the name link opens `/products/{id}`
- [x] 3.2 Add loading (`Skeleton` rows), error (`Retry` calling `refetch`) and empty (`Clear filters` resetting the URL state) states to the list; verify each state in the browser (stop the API for the error state; search for a nonsense term for the empty state)
- [x] 3.3 Replace `delete-product-button.tsx` with `delete-product-dialog.tsx` (Radix `AlertDialog`, `Cancel`/`Delete`, `useMutation` invalidating `["products"]`, optional `onDeleted` callback); update `products-table.test.tsx` to query `role="alertdialog"` and add a test that `Escape` closes it without a request; verify `pnpm --filter web test` passes

## 4. Forms

- [x] 4.1 Rebuild `product-form.tsx` on shadcn `Form`/`FormField`/`FormLabel`/`FormControl`/`FormMessage` inside a `Card` (SKU + name row, description, three-column price/stock/weight grid, category with `<datalist>`, `Save`/`Cancel` actions), keeping `useForm`, `zodResolver`, `setValueAs` coercions and `applyApiError`; verify `product-form.test.tsx` passes unchanged and the browser shows field errors for an empty name and `-1` price with no request
- [x] 4.2 Restyle `new-product-page.tsx` and `edit-product-page.tsx` (breadcrumb, page header, loading skeleton and not-found state on edit); verify creating and editing a product through the browser still lands on `/products` with the change visible

## 5. Product detail page

- [x] 5.1 Add `src/components/products/product-detail-page.tsx` and `app/products/[id]/page.tsx`: breadcrumb, hero name, display price, description, definition grid (SKU, category, stock, weight, created, updated), `Edit` link and `DeleteProductDialog` navigating to `/products` on success; loading skeleton; not-found state for a `404` `ApiError` with a link to the list, no retry on 404; verify in the browser with an existing product and with a random uuid
- [x] 5.2 Add `product-detail-page.test.tsx` covering: every field rendered from a stubbed `GET /products/{id}`, the not-found state on a stubbed 404, and confirm-delete sending `DELETE` then calling the navigation; verify `pnpm --filter web test` passes

## 6. Verification and docs

- [x] 6.1 Run the Playwright scenario script against `pnpm dev` (search + URL, category filter, sort, delete cancel/confirm via the dialog, form errors with zero POSTs, 409 on the SKU field, `<script>` name as text, detail page and its 404) and a screenshot pass of home, list, form and detail at 390px and 1280px; verify every scenario passes and the screenshots show no overflow or unstyled control
- [x] 6.2 Update `README.md` (quality gate mentions Tailwind/shadcn and the lint on copied components, repository layout gains `components/ui` and `components/layout`, Decisions gains the design-system entries D1–D3, Status table marks `web-design-system` in progress); verify `pnpm format:check` passes
- [x] 6.3 Run `pnpm check` and `docker compose up --build` from a clean volume; verify both succeed, the web container serves the styled `/products` with the vendored fonts (no request to fonts.googleapis.com in the browser network log), and a product created through the form appears in the list and on its detail page
