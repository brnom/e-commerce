"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ProductForm } from "./product-form";
import { categoryKeys, createProduct, productKeys } from "@/lib/products-api";

export function NewProductPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return (
    <main>
      <nav className="breadcrumb">
        <Link href="/products">← Products</Link>
      </nav>
      <h1>New product</h1>
      <ProductForm
        submitLabel="Create product"
        onSubmit={async (values) => {
          await createProduct(values);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: productKeys.all }),
            queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
          ]);
          router.push("/products");
        }}
      />
    </main>
  );
}
