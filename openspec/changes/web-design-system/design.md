# Design

## Context

`apps/web` is a client-side Next.js 16 App Router app with TanStack Query, `react-hook-form` + `zodResolver` over the shared schemas, and a hand-written 60-line `globals.css`. The product list keeps its filters in the URL (`src/lib/product-list-params.ts`, `use-product-list-state.ts`), the form maps API `400`/`409` bodies onto fields (`product-form.tsx`), deletion is an inline two-step control, and tests stub `fetch` through `src/test-utils.tsx`. None of that logic changes; this design replaces the presentation layer around it.

Constraints from the repository: no comments in source (including files copied from a component library), `import-x/order`, Prettier, `no-restricted-syntax` on `dangerouslySetInnerHTML`, `output: "standalone"` Docker build, no images anywhere in the UI.

Direction: black and white, typography as the visual subject. A fashion storefront reference (large uppercase display type, black blocks, wide margins, price treated as a graphic element) is used for tone, not copied: the main surface here is a working table, so density and alignment win over editorial layout.

## Goals / Non-Goals

**Goals:**

- One component vocabulary (buttons, inputs, selects, tables, dialogs, cards, badges, skeletons) that the import and purchase screens reuse without new CSS.
- A recognizable identity from typography alone: display headings, mono figures, black primary actions.
- Every data view has loading, empty, error and not-found states; dialogs and selects are keyboard-accessible primitives.
- Deterministic builds: no network fetch for fonts at build time.

**Non-Goals:**

- Dark mode. It would double every visual check and offers nothing to an admin catalog; the token structure allows adding it later.
- Responsive table-to-cards transformation; the table scrolls horizontally on narrow screens.
- Animation beyond the primitives' defaults.
- A component library package; components live in `apps/web/src/components/ui` and are edited in place.

## Decisions

### D1. Tailwind CSS v4 + shadcn/ui, components copied into the repository

shadcn is not a dependency but a generator: `pnpm dlx shadcn@latest add <component>` writes a `.tsx` file into `src/components/ui/`, built on `radix-ui` primitives, `class-variance-authority`, `clsx` and `tailwind-merge` (`cn()` in `src/lib/utils.ts`). The files are ours afterwards and pass through the repository lint like any other source: after each `add`, `eslint --fix` sorts imports and any comment the generator emits is removed. Tailwind v4 is configured through `@tailwindcss/postcss` and `@import "tailwindcss"` in `globals.css`; there is no `tailwind.config` file. `prettier-plugin-tailwindcss` keeps class order canonical so diffs stay readable.

Alternatives: **MUI** — complete, but its Material idiom (elevation, ripple, Roboto, rounded chips) is the opposite of the intended tone and must be undone through theming; also needs an Emotion/App Router bridge. **Radix Themes** — accessible and easy to theme black/white, but its layout components fight Tailwind and its table is thin. **Hand-written CSS** — what exists today; accessible dialog and select would have to be written and tested by hand.

### D2. Tokens: shadcn `neutral` palette collapsed to black, white and one gray

`globals.css` keeps shadcn's CSS-variable contract (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--ring`, `--radius`…) so components stay untouched, and sets the values to pure `#000`/`#fff` with a single gray for muted text and borders. `--radius` keeps shadcn's default (`0.625rem`): the reference's square corners were judged less important than staying on the library's defaults. Focus rings are black; destructive is black with white text (no red — the dialog wording carries the danger).

### D3. Type: vendored Archivo (display) and Geist (interface)

- **Archivo** variable font (SIL OFL) at `src/fonts/Archivo-Variable.woff2`, loaded with `next/font/local`, used for headings with `font-stretch: 125%`, uppercase and `tracking-tight`. Its width axis gives the expanded look of the reference from one file.
- **Geist Sans** and **Geist Mono** from the `geist` npm package (`geist/font/sans`, `geist/font/mono`), which ship the files locally. Mono is used for SKU, price, stock, weight, counts and timestamps so figures align.

Both are exposed as CSS variables (`--font-display`, `--font-sans`, `--font-mono`) mapped to Tailwind `font-display`, `font-sans`, `font-mono`. `next/font/google` was rejected because it downloads at build time and would make `docker build` depend on Google's availability.

### D4. Application shell

```
app/layout.tsx
  <html class={fonts}> <body>
    <QueryProvider>
      <SiteHeader/>          wordmark · nav (Products) · <ApiHealth/> as a mono badge
      <main class="container max-w-6xl px-4 py-10">{children}</main>
      <SiteFooter/>          one line, mono
```

`SiteHeader` and `SiteFooter` are server components (no state); `ApiHealth` stays the existing client component with its `data-testid`. The home page is a landing: a display headline, one sentence, one primary `Button` link to `/products`.

### D5. Pages on the new components

- **List** (`products-page.tsx`): `PageHeader` (uppercase display title, mono `n products`, `New product` primary button) → filter bar (`Input` with a search icon, `Select` for category; the search input keeps its debounce and URL sync) → `Table` with mono SKU, name as `Link` to the detail page, category `Badge` (outline), right-aligned mono price and stock, header buttons with `aria-sort`, row actions `Edit` (ghost) and `Delete` (ghost, opens the dialog) → `Pagination`. While loading, five `Skeleton` rows; on error, an inline error with `Retry` (`refetch`); when `items` is empty, an empty state with `Clear filters` (resets the URL state).
- **Delete** (`delete-product-dialog.tsx`, replaces `delete-product-button.tsx`): Radix `AlertDialog` with title, the product name, `Cancel` and `Delete`; `useMutation` invalidates `["products"]`; on the detail page it also navigates to `/products`. Radix handles focus trap, `Escape` and focus return.
- **Forms** (`product-form.tsx`): shadcn `Form` (`FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`) over the existing `useForm` instance and `applyApiError`; the layout is a `Card` with SKU + name, description, a three-column grid for price/stock/weight, category with the `<datalist>`; actions `Save` (primary) and `Cancel` (outline link).
- **Detail** (`product-detail-page.tsx`, new route `app/products/[id]/page.tsx`): breadcrumb link, name as the hero (display, uppercase, `text-5xl`–`text-7xl`), price in display mono, description in a measured column, then a definition grid (SKU, category, stock, weight, created, updated) styled as the reference's "size chart": small uppercase mono labels, large values. Actions `Edit` and `Delete`. Uses `getProduct` + `productKeys.detail`; a `404` `ApiError` renders the not-found state (no retry on 404).

### D6. Tests

Component tests keep `src/test-utils.tsx` (`renderWithQuery`, `stubApi`). Radix `AlertDialog` renders a `role="alertdialog"` with the buttons inside, so `products-table.test.tsx` queries the dialog by role instead of the inline group. Radix `Select` needs `pointer-events` polyfills in jsdom; the filter select is exercised in the Playwright run rather than in jsdom. A new `product-detail-page.test.tsx` covers the fields, the not-found state and the delete flow with a stubbed API.

## Risks / Trade-offs

- [Copied shadcn files may contain comments or unused directives that fail the lint] → Each `add` is followed by `eslint --fix` and a manual comment strip; the lint runs in CI so nothing slips.
- [Tailwind utility classes in JSX make components verbose] → The Prettier plugin sorts classes; repeated combinations move into `cva` variants inside the `ui/` components rather than into ad-hoc CSS.
- [shadcn's Radix `Select` in jsdom needs `hasPointerCapture`/`scrollIntoView` shims] → Filter interactions are verified with Playwright; if a jsdom test becomes necessary, add the three-line shim to `vitest.setup.ts`.
- [Vendored font binary in the repository] → ~80 KB, OFL-licensed, with the license file alongside; it removes a build-time network dependency.
- [Next 16 `next/font/local` in the standalone Docker output] → Fonts are emitted as static assets under `.next/static`, which the existing Dockerfile already copies.
- [Restyling touches every web test] → Behavior under test is unchanged (labels, roles, fetch calls); only selectors for the delete control move.

## Migration Plan

Additive; no data or API change. `globals.css` is rewritten in one commit together with the Tailwind setup so there is no intermediate state where both systems apply. Rollback is reverting the change.

## Open Questions

- Exact display sizes per breakpoint (`text-5xl` vs `text-6xl` for the detail hero). Tuned during implementation with the screenshot pass; does not affect specs or tasks.
