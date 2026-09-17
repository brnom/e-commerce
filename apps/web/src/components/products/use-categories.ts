"use client";

import { useQuery } from "@tanstack/react-query";

import { categoryKeys, listCategories } from "@/lib/products-api";

export function useCategories() {
  return useQuery({ queryKey: categoryKeys.all, queryFn: listCategories });
}
