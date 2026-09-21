import { describe, expect, it } from "vitest";

import {
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from "./product.schema";

const valid = { sku: "RS-001", name: "Running Shoes", price: 89.99, stock: 150 };

const failingPaths = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}) => (result.success ? [] : result.error!.issues.map((issue) => issue.path.join(".")));

describe("createProductSchema", () => {
  it("rejects a blank name", () => {
    expect(failingPaths(createProductSchema.safeParse({ ...valid, name: "   " }))).toEqual([
      "name",
    ]);
  });

  it("rejects a price with a currency symbol", () => {
    expect(failingPaths(createProductSchema.safeParse({ ...valid, price: "$29.99" }))).toEqual([
      "price",
    ]);
  });

  it("rejects negative stock", () => {
    expect(failingPaths(createProductSchema.safeParse({ ...valid, stock: -5 }))).toEqual(["stock"]);
  });

  it("rejects a price with more than two decimal places", () => {
    expect(failingPaths(createProductSchema.safeParse({ ...valid, price: 29.999 }))).toEqual([
      "price",
    ]);
  });

  it("accepts a zero price and a missing weight", () => {
    const result = createProductSchema.parse({ ...valid, price: 0 });

    expect(result.price).toBe(0);
    expect(result.weightKg).toBeUndefined();
  });

  it("normalizes the sku by trimming and upper-casing", () => {
    expect(createProductSchema.parse({ ...valid, sku: " rs-001 " }).sku).toBe("RS-001");
  });

  it("reports every invalid field together", () => {
    expect(failingPaths(createProductSchema.safeParse({ ...valid, name: "", stock: -1 }))).toEqual([
      "name",
      "stock",
    ]);
  });
});

describe("updateProductSchema", () => {
  it("accepts a partial body and a null category", () => {
    expect(updateProductSchema.parse({ stock: 12, category: null })).toEqual({
      stock: 12,
      category: null,
    });
  });
});

describe("listProductsQuerySchema", () => {
  it("applies defaults", () => {
    expect(listProductsQuerySchema.parse({})).toEqual({
      sort: "createdAt",
      order: "desc",
      page: 1,
      limit: 20,
    });
  });

  it("coerces numeric query strings", () => {
    expect(listProductsQuerySchema.parse({ page: "3", limit: "50" })).toMatchObject({
      page: 3,
      limit: 50,
    });
  });

  it("rejects a limit above 100", () => {
    expect(failingPaths(listProductsQuerySchema.safeParse({ limit: "500" }))).toEqual(["limit"]);
  });
});
