import { z } from "zod";

export const createBaseResponsavelSchema = z.object({
  sigla: z.string().min(1),
  responsavel: z.string().min(1),
  visibilidade: z.string().min(1),
  telefone: z.string().min(1).nullable().optional(),
});

export const updateBaseResponsavelSchema = z
  .object({
    responsavel: z.string().min(1).optional(),
    visibilidade: z.string().min(1).optional(),
    telefone: z.string().min(1).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Pelo menos um campo deve ser enviado para atualização.",
  });
