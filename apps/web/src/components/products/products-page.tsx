"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";

import { Pagination } from "./pagination";
import { ProductFilters } from "./product-filters";
import { ProductsTable, ProductsTableSkeleton } from "./products-table";
import { EmptyState, ErrorState } from "./states";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { defaultListState, toListParams } from "@/lib/product-list-params";
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
  const filtered = state.q !== "" || state.category !== "";

  const toggleSort = (sort: ProductSortField) =>
    update({
      sort,
      order: state.sort === sort && state.order === "asc" ? "desc" : "asc",
      page: 1,
    });

  return (
    <main>
      <PageHeader
        title="Products"
        eyebrow={
          products.data
            ? `${products.data.total} ${products.data.total === 1 ? "product" : "products"}`
            : "Catalog"
        }
        actions={
          <Button asChild>
            <Link href="/products/new">
              <Plus />
              New product
            </Link>
          </Button>
        }
      />
      <ProductFilters state={state} onChange={update} />
      {products.isPending && <ProductsTableSkeleton />}
      {products.isError && (
        <ErrorState message="Could not load products." onRetry={() => products.refetch()} />
      )}
      {products.data && products.data.items.length === 0 && (
        <EmptyState
          title={filtered ? "No products match" : "No products yet"}
          description={
            filtered
              ? "Try another search term or category."
              : "Create the first product to start the catalog."
          }
          action={
            filtered ? (
              <Button variant="outline" onClick={() => update(defaultListState)}>
                Clear filters
              </Button>
            ) : (
              <Button asChild>
                <Link href="/products/new">New product</Link>
              </Button>
            )
          }
        />
      )}
      {products.data && products.data.items.length > 0 && (
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
