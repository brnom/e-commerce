"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ProductForm } from "./product-form";
import { ApiError } from "@/lib/api-client";
import { categoryKeys, getProduct, productKeys, updateProduct } from "@/lib/products-api";

export function EditProductPage({ productId }: { readonly productId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const product = useQuery({
    queryKey: productKeys.detail(productId),
    queryFn: () => getProduct(productId),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 1,
  });

  return (
    <main>
      <nav className="breadcrumb">
        <Link href="/products">← Products</Link>
      </nav>
      <h1>Edit product</h1>
      {product.isPending && <p>Loading…</p>}
      {product.isError && (
        <p role="alert">
          {product.error instanceof ApiError && product.error.status === 404
            ? "This product does not exist."
            : "Could not load the product."}
        </p>
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
