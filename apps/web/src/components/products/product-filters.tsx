"use client";

import { useEffect, useState } from "react";

import { useCategories } from "./use-categories";

import type { ProductListState } from "@/lib/product-list-params";

const SEARCH_DEBOUNCE_MS = 300;

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
    <div className="filters" role="search">
      <label>
        Search
        <input
          type="search"
          name="q"
          placeholder="Name or description"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <label>
        Category
        <select
          name="category"
          value={state.category}
          onChange={(event) => onChange({ category: event.target.value, page: 1 })}
        >
          <option value="">All categories</option>
          {categories.data?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
