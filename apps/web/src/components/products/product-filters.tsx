"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { useCategories } from "./use-categories";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { ProductListState } from "@/lib/product-list-params";

const SEARCH_DEBOUNCE_MS = 300;
const ALL_CATEGORIES = "all";

interface Props {
  readonly state: ProductListState;
  readonly onChange: (changes: Partial<ProductListState>) => void;
}

export function ProductFilters({ state, onChange }: Props) {
  const [search, setSearch] = useState(state.q);
  const [syncedQuery, setSyncedQuery] = useState(state.q);
  const categories = useCategories();

  if (syncedQuery !== state.q) {
    setSyncedQuery(state.q);
    setSearch(state.q);
  }

  useEffect(() => {
    if (search === state.q) return;
    const timer = setTimeout(() => onChange({ q: search, page: 1 }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, state.q, onChange]);

  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end" role="search">
      <div className="grid flex-1 gap-2">
        <Label htmlFor="product-search">Search</Label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="product-search"
            type="search"
            name="q"
            placeholder="Name or description"
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-2 sm:w-64">
        <Label htmlFor="product-category">Category</Label>
        <Select
          name="category"
          value={state.category || ALL_CATEGORIES}
          onValueChange={(value) =>
            onChange({ category: value === ALL_CATEGORIES ? "" : value, page: 1 })
          }
        >
          <SelectTrigger id="product-category" className="w-full">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
            {categories.data?.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
