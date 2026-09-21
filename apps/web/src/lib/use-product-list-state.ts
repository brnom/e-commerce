"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { readListState, writeListState, type ProductListState } from "./product-list-params";

export function useProductListState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = useMemo(() => readListState(searchParams), [searchParams]);

  const update = useCallback(
    (changes: Partial<ProductListState>) => {
      const next = { ...state, ...changes };
      router.replace(`${pathname}${writeListState(next)}`);
    },
    [pathname, router, state],
  );

  return { state, update };
}
