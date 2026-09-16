import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ZodValidationPipe } from "./zod-validation.pipe";

const schema = z.object({ name: z.string().min(1), price: z.number().nonnegative() });

describe("ZodValidationPipe", () => {
  const pipe = new ZodValidationPipe(schema);

  it("returns the parsed value for a valid payload", () => {
    expect(pipe.transform({ name: "Lamp", price: 10 })).toEqual({ name: "Lamp", price: 10 });
  });

  it("throws a 400 listing every issue for an invalid payload", () => {
    let caught: unknown;
    try {
      pipe.transform({ name: "", price: -1 });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BadRequestException);
    const response = (caught as BadRequestException).getResponse() as {
      message: string;
      issues: Array<{ path: string; message: string }>;
    };
    expect(response.message).toBe("Validation failed");
    expect(response.issues.map((issue) => issue.path)).toEqual(["name", "price"]);
  });
});
