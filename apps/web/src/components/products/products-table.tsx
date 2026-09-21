"use client";

import Link from "next/link";

import { DeleteProductButton } from "./delete-product-button";

import type { ProductListState } from "@/lib/product-list-params";
import type { ProductResponse, ProductSortField } from "@ecommerce/shared";

interface Props {
  readonly items: ProductResponse[];
  readonly state: ProductListState;
  readonly onSort: (sort: ProductSortField) => void;
}

const columns: ReadonlyArray<{ field: ProductSortField; label: string }> = [
  { field: "name", label: "Name" },
  { field: "price", label: "Price" },
  { field: "stock", label: "Stock" },
];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function ProductsTable({ items, state, onSort }: Props) {
  const sortIndicator = (field: ProductSortField) =>
    state.sort === field ? (state.order === "asc" ? " ▲" : " ▼") : "";

  return (
    <table className="products">
      <thead>
        <tr>
          <th scope="col">SKU</th>
          {columns.map((column) => (
            <th
              key={column.field}
              scope="col"
              aria-sort={
                state.sort === column.field
                  ? state.order === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              <button type="button" className="sort" onClick={() => onSort(column.field)}>
                {column.label}
                {sortIndicator(column.field)}
              </button>
            </th>
          ))}
          <th scope="col">Category</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.length === 0 && (
          <tr>
            <td colSpan={6} className="empty">
              No products match.
            </td>
          </tr>
        )}
        {items.map((product) => (
          <tr key={product.id}>
            <td>
              <code>{product.sku}</code>
            </td>
            <td>{product.name}</td>
            <td>{money.format(product.price)}</td>
            <td>{product.stock}</td>
            <td>{product.category?.name ?? "—"}</td>
            <td className="actions">
              <Link href={`/products/${product.id}/edit`}>Edit</Link>
              <DeleteProductButton productId={product.id} productName={product.name} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
