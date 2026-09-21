import { apiClient } from "./api-client";

import type {
  CategoryResponse,
  CreateProductInput,
  ListProductsQueryInput,
  ProductPage,
  ProductResponse,
  UpdateProductInput,
} from "@ecommerce/shared";

export type ProductListParams = Pick<
  ListProductsQueryInput,
  "q" | "category" | "sort" | "order" | "page" | "limit"
>;

export const productKeys = {
  all: ["products"] as const,
  list: (params: ProductListParams) => ["products", "list", params] as const,
  detail: (id: string) => ["products", "detail", id] as const,
};

export const categoryKeys = {
  all: ["categories"] as const,
};

function toSearchParams(params: ProductListParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

export function listProducts(params: ProductListParams): Promise<ProductPage> {
  return apiClient<ProductPage>(`/products${toSearchParams(params)}`);
}

export function getProduct(id: string): Promise<ProductResponse> {
  return apiClient<ProductResponse>(`/products/${encodeURIComponent(id)}`);
}

export function createProduct(input: CreateProductInput): Promise<ProductResponse> {
  return apiClient<ProductResponse>("/products", { method: "POST", body: JSON.stringify(input) });
}

export function updateProduct(id: string, input: UpdateProductInput): Promise<ProductResponse> {
  return apiClient<ProductResponse>(`/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteProduct(id: string): Promise<null> {
  return apiClient<null>(`/products/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function listCategories(): Promise<CategoryResponse[]> {
  return apiClient<CategoryResponse[]>("/categories");
}
