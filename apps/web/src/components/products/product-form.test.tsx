import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductForm } from "./product-form";
import { ApiError } from "@/lib/api-client";
import { calls, renderWithQuery, stubApi } from "@/test-utils";

describe("ProductForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks submission and shows field messages without calling the API", async () => {
    const fetchMock = stubApi([{ path: /\/categories$/, body: [] }]);
    const onSubmit = vi.fn();
    renderWithQuery(<ProductForm submitLabel="Create" onSubmit={onSubmit} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("SKU"), "NEW-1");
    await user.type(screen.getByLabelText("Price"), "-1");
    await user.type(screen.getByLabelText("Stock"), "1");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Price must be zero or more")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(calls(fetchMock, "POST")).toHaveLength(0);
  });

  it("places a 409 conflict message next to the SKU field", async () => {
    stubApi([{ path: /\/categories$/, body: [] }]);
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError(409, {
        message: 'sku "RS-001" is already taken',
        field: "sku",
        value: "RS-001",
      }),
    );
    renderWithQuery(<ProductForm submitLabel="Create" onSubmit={onSubmit} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("SKU"), "rs-001");
    await user.type(screen.getByLabelText("Name"), "Running Shoes");
    await user.type(screen.getByLabelText("Price"), "89.99");
    await user.type(screen.getByLabelText("Stock"), "150");
    await user.click(screen.getByRole("button", { name: "Create" }));

    const skuField = screen.getByLabelText("SKU");
    expect(await screen.findByText('sku "RS-001" is already taken')).toBeInTheDocument();
    expect(skuField).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ sku: "RS-001", name: "Running Shoes", price: 89.99, stock: 150 }),
    );
  });

  it("offers existing categories as suggestions", async () => {
    stubApi([{ path: /\/categories$/, body: [{ id: "c1", name: "Footwear" }] }]);
    renderWithQuery(<ProductForm submitLabel="Create" onSubmit={vi.fn()} />);

    await vi.waitFor(() =>
      expect(document.querySelector('datalist option[value="Footwear"]')).not.toBeNull(),
    );
  });
});
