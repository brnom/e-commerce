import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductsTable } from "./products-table";
import { defaultListState } from "@/lib/product-list-params";
import { calls, renderWithQuery, stubApi } from "@/test-utils";

import type { ProductResponse } from "@ecommerce/shared";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const product = (overrides: Partial<ProductResponse>): ProductResponse => ({
  id: "01a0c40d-90c3-750a-af78-7d4aa60d284e",
  sku: "RS-001",
  name: "Running Shoes",
  description: null,
  price: 89.99,
  stock: 150,
  weightKg: null,
  category: { id: "c1", name: "Footwear" },
  createdAt: "2026-09-21T00:00:00.000Z",
  updatedAt: "2026-09-21T00:00:00.000Z",
  ...overrides,
});

describe("ProductsTable", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders markup in product fields as literal text", () => {
    stubApi([]);
    const name = "<script>alert('xss')</script>";
    renderWithQuery(
      <ProductsTable items={[product({ name })]} state={defaultListState} onSort={vi.fn()} />,
    );

    expect(screen.getByRole("cell", { name })).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });

  it("requires confirmation before deleting and sends nothing when cancelled", async () => {
    const fetchMock = stubApi([{ method: "DELETE", path: /\/products\//, status: 204 }]);
    renderWithQuery(
      <ProductsTable items={[product({})]} state={defaultListState} onSort={vi.fn()} />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete Running Shoes" }));
    const confirmation = screen.getByRole("group", { name: "Confirm deleting Running Shoes" });
    await user.click(within(confirmation).getByRole("button", { name: "Cancel" }));

    expect(calls(fetchMock, "DELETE")).toHaveLength(0);
    expect(screen.getByRole("cell", { name: "Running Shoes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Running Shoes" })).toBeInTheDocument();
  });

  it("sends the delete request once confirmed", async () => {
    const fetchMock = stubApi([{ method: "DELETE", path: /\/products\//, status: 204 }]);
    renderWithQuery(
      <ProductsTable items={[product({})]} state={defaultListState} onSort={vi.fn()} />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete Running Shoes" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await vi.waitFor(() => expect(calls(fetchMock, "DELETE")).toHaveLength(1));
    expect(calls(fetchMock, "DELETE")[0]?.[0]).toMatch(
      /\/products\/01a0c40d-90c3-750a-af78-7d4aa60d284e$/,
    );
  });

  it("reports the active sort on the column header and toggles on click", async () => {
    stubApi([]);
    const onSort = vi.fn();
    renderWithQuery(
      <ProductsTable
        items={[product({})]}
        state={{ ...defaultListState, sort: "price", order: "asc" }}
        onSort={onSort}
      />,
    );

    expect(screen.getByRole("columnheader", { name: /Price/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /Stock/ }));
    expect(onSort).toHaveBeenCalledWith("stock");
  });
});
