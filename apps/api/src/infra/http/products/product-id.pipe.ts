import { Injectable, PipeTransform } from "@nestjs/common";
import { z } from "zod";

import { NotFoundError } from "@/domain/shared/domain-error";

const uuid = z.uuid();

@Injectable()
export class ProductIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!uuid.safeParse(value).success) {
      throw new NotFoundError("product", value);
    }
    return value;
  }
}
