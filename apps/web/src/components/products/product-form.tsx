"use client";

import { createProductSchema, type CreateProductInput } from "@ecommerce/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm, type FieldPath } from "react-hook-form";

import { useCategories } from "./use-categories";
import { ApiError } from "@/lib/api-client";

export type ProductFormValues = CreateProductInput;

interface Props {
  readonly defaultValues?: Partial<ProductFormValues>;
  readonly submitLabel: string;
  readonly onSubmit: (values: ProductFormValues) => Promise<unknown>;
}

const fieldNames: ReadonlySet<string> = new Set([
  "sku",
  "name",
  "description",
  "price",
  "stock",
  "weightKg",
  "category",
]);

const isFieldName = (path: string): path is FieldPath<ProductFormValues> => fieldNames.has(path);

type ValidationBody = { issues?: Array<{ path: string; message: string }> };
type ConflictBody = { field?: string; message?: string };

const emptyToNull = (value: string) => (value.trim() === "" ? null : value);
const numberOrUndefined = (value: string) => (value === "" ? undefined : Number(value));
const numberOrNull = (value: string) => (value === "" ? null : Number(value));

export function ProductForm({ defaultValues, submitLabel, onSubmit }: Props) {
  const categories = useCategories();
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { description: "", category: "", ...defaultValues },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      if (!applyApiError(error)) {
        form.setError("root", { message: "The product could not be saved. Try again." });
      }
    }
  });

  function applyApiError(error: unknown): boolean {
    if (!(error instanceof ApiError)) return false;
    if (error.status === 400) {
      const issues = (error.body as ValidationBody).issues ?? [];
      const fieldIssues = issues.filter((issue) => isFieldName(issue.path));
      for (const issue of fieldIssues) {
        if (isFieldName(issue.path)) form.setError(issue.path, { message: issue.message });
      }
      return fieldIssues.length > 0;
    }
    if (error.status === 409) {
      const { field, message } = error.body as ConflictBody;
      if (field && isFieldName(field)) {
        form.setError(field, { message: message ?? "Already taken" });
        return true;
      }
    }
    return false;
  }

  const fieldError = (name: FieldPath<ProductFormValues>) =>
    errors[name] ? (
      <span className="field-error" role="alert" id={`${name}-error`}>
        {errors[name]?.message}
      </span>
    ) : null;

  const describedBy = (name: FieldPath<ProductFormValues>) =>
    errors[name] ? `${name}-error` : undefined;

  return (
    <form className="product-form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="sku">SKU</label>
        <input
          id="sku"
          {...form.register("sku")}
          aria-invalid={!!errors.sku}
          aria-describedby={describedBy("sku")}
        />
        {fieldError("sku")}
      </div>
      <div className="field">
        <label htmlFor="name">Name</label>
        <input
          id="name"
          {...form.register("name")}
          aria-invalid={!!errors.name}
          aria-describedby={describedBy("name")}
        />
        {fieldError("name")}
      </div>
      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          rows={3}
          {...form.register("description", { setValueAs: emptyToNull })}
          aria-invalid={!!errors.description}
          aria-describedby={describedBy("description")}
        />
        {fieldError("description")}
      </div>
      <div className="field">
        <label htmlFor="price">Price</label>
        <input
          id="price"
          type="number"
          step="0.01"
          min="0"
          {...form.register("price", { setValueAs: numberOrUndefined })}
          aria-invalid={!!errors.price}
          aria-describedby={describedBy("price")}
        />
        {fieldError("price")}
      </div>
      <div className="field">
        <label htmlFor="stock">Stock</label>
        <input
          id="stock"
          type="number"
          step="1"
          min="0"
          {...form.register("stock", { setValueAs: numberOrUndefined })}
          aria-invalid={!!errors.stock}
          aria-describedby={describedBy("stock")}
        />
        {fieldError("stock")}
      </div>
      <div className="field">
        <label htmlFor="weightKg">Weight (kg)</label>
        <input
          id="weightKg"
          type="number"
          step="0.001"
          min="0"
          {...form.register("weightKg", { setValueAs: numberOrNull })}
          aria-invalid={!!errors.weightKg}
          aria-describedby={describedBy("weightKg")}
        />
        {fieldError("weightKg")}
      </div>
      <div className="field">
        <label htmlFor="category">Category</label>
        <input
          id="category"
          list="category-names"
          {...form.register("category", { setValueAs: emptyToNull })}
          aria-invalid={!!errors.category}
          aria-describedby={describedBy("category")}
        />
        <datalist id="category-names">
          {categories.data?.map((category) => (
            <option key={category.id} value={category.name} />
          ))}
        </datalist>
        {fieldError("category")}
      </div>
      {errors.root && <p role="alert">{errors.root.message}</p>}
      <div className="form-actions">
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : submitLabel}
        </button>
        <Link href="/products" className="button">
          Cancel
        </Link>
      </div>
    </form>
  );
}
