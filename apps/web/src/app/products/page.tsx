import { Suspense } from "react";

import { ProductsPage } from "@/components/products/products-page";

export default function ProductsRoute() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <ProductsPage />
    </Suspense>
  );
}
