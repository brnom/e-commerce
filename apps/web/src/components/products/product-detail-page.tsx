"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Breadcrumb } from "./breadcrumb";
import { DeleteProductDialog } from "./delete-product-dialog";
import { ProductNotFound } from "./product-not-found";
import { ErrorState } from "./states";
import { isNotFound, useProduct } from "./use-product";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatMoney, formatWeight } from "@/lib/format";

import type { ProductResponse } from "@ecommerce/shared";

function SpecSheet({ product }: { readonly product: ProductResponse }) {
  const rows: ReadonlyArray<{ label: string; value: string }> = [
    { label: "SKU", value: product.sku },
    { label: "Category", value: product.category?.name ?? "—" },
    { label: "Stock", value: String(product.stock) },
    { label: "Weight", value: formatWeight(product.weightKg) },
    { label: "Created", value: formatDateTime(product.createdAt) },
    { label: "Updated", value: formatDateTime(product.updatedAt) },
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="mb-1 font-mono text-xs tracking-wider text-muted-foreground uppercase">
            {row.label}
          </dt>
          <dd className="display-heading text-xl sm:text-2xl">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProductDetailPage({ productId }: { readonly productId: string }) {
  const router = useRouter();
  const product = useProduct(productId);

  if (product.isError && isNotFound(product.error)) {
    return (
      <main>
        <ProductNotFound />
      </main>
    );
  }

  return (
    <main>
      <Breadcrumb
        items={[{ href: "/products", label: "Products" }]}
        current={product.data?.name ?? "Product"}
      />
      {product.isPending && (
        <div className="space-y-6" aria-busy="true" aria-label="Loading product">
          <Skeleton className="h-20 w-2/3" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}
      {product.isError && (
        <ErrorState message="Could not load the product." onRetry={() => product.refetch()} />
      )}
      {product.data && (
        <article className="grid gap-10 lg:grid-cols-[1fr_20rem]">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              {product.data.category && (
                <Badge variant="outline" className="w-fit font-mono text-[11px] uppercase">
                  {product.data.category.name}
                </Badge>
              )}
              <h1 className="display-heading text-4xl leading-none wrap-anywhere sm:text-6xl lg:text-7xl">
                {product.data.name}
              </h1>
              <p className="font-mono text-4xl tabular-nums sm:text-5xl">
                {formatMoney(product.data.price)}
              </p>
            </div>
            {product.data.description && (
              <p className="max-w-2xl text-lg text-muted-foreground">{product.data.description}</p>
            )}
            <Separator />
            <SpecSheet product={product.data} />
          </div>
          <aside className="flex flex-col gap-2 lg:pt-2">
            <Button asChild size="lg">
              <Link href={`/products/${productId}/edit`}>Edit product</Link>
            </Button>
            <DeleteProductDialog
              productId={productId}
              productName={product.data.name}
              variant="outline"
              size="lg"
              onDeleted={() => router.push("/products")}
            />
          </aside>
        </article>
      )}
    </main>
  );
}
