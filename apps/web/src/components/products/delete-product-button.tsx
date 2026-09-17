"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { deleteProduct, productKeys } from "@/lib/products-api";

interface Props {
  readonly productId: string;
  readonly productName: string;
}

export function DeleteProductButton({ productId, productName }: Props) {
  const [confirming, setConfirming] = useState(false);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => deleteProduct(productId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${productName}`}
      >
        Delete
      </button>
    );
  }

  return (
    <span className="confirm" role="group" aria-label={`Confirm deleting ${productName}`}>
      <button
        type="button"
        className="danger"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Deleting…" : "Confirm"}
      </button>
      <button type="button" disabled={mutation.isPending} onClick={() => setConfirming(false)}>
        Cancel
      </button>
      {mutation.isError && <span role="alert">Could not delete the product.</span>}
    </span>
  );
}
