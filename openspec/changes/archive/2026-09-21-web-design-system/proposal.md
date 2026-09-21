# Proposal

## Why

The catalog is functional but the web app is unstyled: native controls, no layout shell, no loading or empty states, and a product can only be seen as a table row. Before more screens arrive (CSV import, purchasing) the app needs a visual system every page shares, so those screens are built on components and conventions instead of ad-hoc CSS.

## What Changes

- Introduce a design system for the web app: Tailwind CSS and shadcn/ui components, a strictly black-and-white palette, and two typefaces (an expanded display face for headings, a sans/mono pair for interface text and figures). No imagery anywhere; typography and whitespace carry the design.
- Add an application shell — header with wordmark, navigation and the API status, a page container and a footer — rendered on every page. The home page becomes a landing that points at the catalog.
- Restyle the product list, the create form and the edit form on the new components: skeleton loading, an empty state that can clear filters, a confirmation dialog for deletion (replacing the inline two-step control), and badges, mono figures and right-aligned numbers in the table.
- Add a product detail page (`/products/{id}`): the product name as the page's hero, the price in display type, the description and a specification grid with every stored field, plus edit and delete actions. The product name in the list links to it. The purchase change will add its buy action to this page.
- Define the states every data view must have (loading, empty, error, not found) and keyboard operability for dialogs, selects and table sorting.

## Capabilities

### New Capabilities

- `web-app-shell`: the frame around every page of the web application — global navigation, API status, page states and keyboard operability.

### Modified Capabilities

- `product-catalog`: the "Catalog user interface" requirement gains a product detail page, a link from the list to it and a confirmation dialog for deletion.

## Impact

- **Web (`apps/web`):** new dependencies `tailwindcss`, `@tailwindcss/postcss`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `radix-ui`, `geist`; `postcss.config.mjs`, `components.json`, `src/components/ui/*` (copied shadcn components, subject to the repository lint), `src/components/layout/*`, `src/lib/fonts.ts` with vendored font files, a rewritten `globals.css`, restyled product components and the new `/products/[id]` route. Root Prettier config gains the Tailwind class-sorting plugin.
- **API and shared:** no changes; the detail page reuses `GET /products/{id}`.
- **Tests:** table tests move from the inline control to the dialog roles; a detail page test is added.
- **Docker:** fonts are vendored so the web image builds without network access beyond package installation.
