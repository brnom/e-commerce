import { productSortFields, type ProductSortField } from "@ecommerce/shared";

import type { ProductListParams } from "./products-api";

export interface ProductListState {
  readonly q: string;
  readonly category: string;
  readonly sort: ProductSortField;
  readonly order: "asc" | "desc";
  readonly page: number;
}

export const defaultListState: ProductListState = {
  q: "",
  category: "",
  sort: "createdAt",
  order: "desc",
  page: 1,
};

const isSortField = (value: string): value is ProductSortField =>
  (productSortFields as readonly string[]).includes(value);

export function readListState(params: URLSearchParams): ProductListState {
  const sort = params.get("sort") ?? "";
  const page = Number.parseInt(params.get("page") ?? "", 10);
  return {
    q: params.get("q") ?? "",
    category: params.get("category") ?? "",
    sort: isSortField(sort) ? sort : defaultListState.sort,
    order: params.get("order") === "asc" ? "asc" : "desc",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function writeListState(state: ProductListState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.category) params.set("category", state.category);
  if (state.sort !== defaultListState.sort) params.set("sort", state.sort);
  if (state.order !== defaultListState.order) params.set("order", state.order);
  if (state.page > 1) params.set("page", String(state.page));
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export function toListParams(state: ProductListState, limit: number): ProductListParams {
  return {
    q: state.q || undefined,
    category: state.category || undefined,
    sort: state.sort,
    order: state.order,
    page: state.page,
    limit,
  };
}
