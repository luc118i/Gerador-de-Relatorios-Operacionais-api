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
  phone: z.string().optional().nullable(),
  // Log de autoria do cadastro (best-effort, enviado pelo app). Ignorado no
  // /drivers/upsert do GAS.
  criadoPor: z.string().optional().nullable(),
  criadoPorId: z.string().uuid().optional().nullable(),
});

// mantém assim, mas vamos tipar na rota
export const updateDriverSchema = z
  .object({
    code: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    base: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Pelo menos um campo deve ser enviado para atualização.",
  });

export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;

// Match em lote: recebe uma lista de motoristas (matrícula e/ou nome, ex.:
// linhas da planilha do iButton) e devolve, para cada um, o registro do
// banco com o telefone. Usado pra "puxar os números" de uma base inteira
// sem N requests ao /drivers/lookup.
export const matchDriversSchema = z.object({
  items: z
    .array(
      z
        .object({
          code: z.string().trim().min(1).optional(),
          name: z.string().trim().min(1).optional(),
        })
        .refine((i) => !!i.code || !!i.name, {
          message: "Cada item precisa de code ou name.",
        }),
    )
    .min(1)
    .max(2000),
  includeInactive: z.boolean().optional().default(false),
});

export type MatchDriversInput = z.infer<typeof matchDriversSchema>;
export type MatchDriverItem = MatchDriversInput["items"][number];
