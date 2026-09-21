"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Breadcrumb } from "./breadcrumb";
import { ProductForm } from "./product-form";
import { ProductNotFound } from "./product-not-found";
import { ErrorState } from "./states";
import { isNotFound, useProduct } from "./use-product";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryKeys, productKeys, updateProduct } from "@/lib/products-api";

export function EditProductPage({ productId }: { readonly productId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
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
        items={[
          { href: "/products", label: "Products" },
          ...(product.data ? [{ href: `/products/${productId}`, label: product.data.name }] : []),
        ]}
        current="Edit"
      />
      <PageHeader title="Edit product" eyebrow={product.data?.sku ?? "Catalog"} />
      {product.isPending && <Skeleton className="h-96 max-w-3xl" aria-label="Loading product" />}
      {product.isError && (
        <ErrorState message="Could not load the product." onRetry={() => product.refetch()} />
      )}
      {product.data && (
        <ProductForm
          submitLabel="Save changes"
          defaultValues={{
            sku: product.data.sku,
            name: product.data.name,
            description: product.data.description ?? "",
            price: product.data.price,
            stock: product.data.stock,
            weightKg: product.data.weightKg,
            category: product.data.category?.name ?? "",
          }}
          onSubmit={async (values) => {
            await updateProduct(productId, values);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: productKeys.all }),
              queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
            ]);
            router.push("/products");
          }}
        />
      )}
    </main>
  );
}
