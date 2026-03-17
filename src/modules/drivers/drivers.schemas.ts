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

// mantém assim, mas vamos tipar na rota
export const updateDriverSchema = z
  .object({
    code: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    base: z.string().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Pelo menos um campo deve ser enviado para atualização.",
  });

export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
