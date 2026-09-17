"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";

import { DeleteProductDialog } from "./delete-product-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format";

import type { ProductListState } from "@/lib/product-list-params";
import type { ProductResponse, ProductSortField } from "@ecommerce/shared";

interface Props {
  readonly items: ProductResponse[];
  readonly state: ProductListState;
  readonly onSort: (sort: ProductSortField) => void;
}

const columns: ReadonlyArray<{ field: ProductSortField; label: string; numeric?: boolean }> = [
  { field: "name", label: "Name" },
  { field: "price", label: "Price", numeric: true },
  { field: "stock", label: "Stock", numeric: true },
];

const SKELETON_ROWS = 5;

export function ProductsTableSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function ProductsTable({ items, state, onSort }: Props) {
  const ariaSort = (field: ProductSortField) =>
    state.sort === field ? (state.order === "asc" ? "ascending" : "descending") : "none";
  const SortIcon = ({ field }: { field: ProductSortField }) =>
    state.sort !== field ? (
      <ArrowUpDown className="text-muted-foreground" />
    ) : state.order === "asc" ? (
      <ArrowUp />
    ) : (
      <ArrowDown />
    );

  return (
    <div className="rounded-lg border">
      <Table className="products">
        <TableHeader>
          <TableRow>
            <TableHead className="font-mono text-xs tracking-wider uppercase">SKU</TableHead>
            {columns.map((column) => (
              <TableHead
                key={column.field}
                aria-sort={ariaSort(column.field)}
                className={column.numeric ? "text-right" : undefined}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={`-mx-2 font-mono text-xs tracking-wider uppercase ${column.numeric ? "-mr-2 ml-auto" : ""}`}
                  onClick={() => onSort(column.field)}
                >
                  {column.label}
                  <SortIcon field={column.field} />
                </Button>
              </TableHead>
            ))}
            <TableHead className="font-mono text-xs tracking-wider uppercase">Category</TableHead>
            <TableHead className="sr-only">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {product.sku}
              </TableCell>
              <TableCell className="font-medium">
                <Link
                  href={`/products/${product.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {product.name}
                </Link>
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatMoney(product.price)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">{product.stock}</TableCell>
              <TableCell>
                {product.category ? (
                  <Badge variant="outline" className="font-mono text-[11px] uppercase">
                    {product.category.name}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/products/${product.id}/edit`}>Edit</Link>
                  </Button>
                  <DeleteProductDialog productId={product.id} productName={product.name} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
