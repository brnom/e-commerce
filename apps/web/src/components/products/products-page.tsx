"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Pagination } from "./pagination";
import { ProductFilters } from "./product-filters";
import { ProductsTable } from "./products-table";
import { toListParams } from "@/lib/product-list-params";
import { listProducts, productKeys } from "@/lib/products-api";
import { useProductListState } from "@/lib/use-product-list-state";

import type { ProductSortField } from "@ecommerce/shared";

const PAGE_SIZE = 20;

export function ProductsPage() {
  const { state, update } = useProductListState();
  const params = toListParams(state, PAGE_SIZE);
  const products = useQuery({
    queryKey: productKeys.list(params),
    queryFn: () => listProducts(params),
    placeholderData: keepPreviousData,
  });

  const toggleSort = (sort: ProductSortField) =>
    update({
      sort,
      order: state.sort === sort && state.order === "asc" ? "desc" : "asc",
      page: 1,
    });

  return (
    <main>
      <header className="page-header">
        <h1>Products</h1>
        <Link href="/products/new" className="button">
          New product
        </Link>
      </header>
      <ProductFilters state={state} onChange={update} />
      {products.isError && <p role="alert">Could not load products.</p>}
      {products.isPending && <p>Loading…</p>}
      {products.data && (
        <>
          <ProductsTable items={products.data.items} state={state} onSort={toggleSort} />
          <Pagination
            page={products.data.page}
            limit={products.data.limit}
            total={products.data.total}
            onPageChange={(page) => update({ page })}
          />
        </>
      )}
    </main>
  );
}
