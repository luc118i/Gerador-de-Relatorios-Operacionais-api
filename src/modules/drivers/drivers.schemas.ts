// src/modules/drivers/drivers.schemas.ts
import { z } from "zod";

export const searchDriversSchema = z.object({
  search: z.string().optional(),
  active: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .default("true"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const createDriverSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  base: z.string().optional().nullable(),
});
