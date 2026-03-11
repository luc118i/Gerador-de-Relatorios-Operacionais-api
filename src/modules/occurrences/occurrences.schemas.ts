// src/modules/occurrences/occurrences.schemas.ts
import { z } from "zod";

export const createOccurrenceSchema = z.object({
  // Tipo de ocorrência (obrigatório)
  typeCode: z.string(),

  // Datas (YYYY-MM-DD obrigatório)
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: "eventDate deve ser no formato YYYY-MM-DD",
    }),
  tripDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: "tripDate deve ser no formato YYYY-MM-DD",
    }),

  // Horários (HH:mm)
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, { message: "startTime deve ser no formato HH:mm" }),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, { message: "endTime deve ser no formato HH:mm" })
    .optional(), // Horário de término pode ser opcional no caso de alguns tipos de ocorrência

  // Prefixo do veículo
  vehicleNumber: z
    .string()
    .trim()
    .min(1, { message: "vehicleNumber é obrigatório e não pode estar vazio" }),

  // Código base
  baseCode: z
    .string()
    .trim()
    .min(1, { message: "baseCode precisa ter pelo menos 1 caractere" })
    .optional(),

  // Identificação da viagem (UUID ou opcional conforme comentário original)
  tripId: z.string().optional(),

  // Prefixo do local é necessário
  place: z
    .string()
    .trim()
    .min(1, { message: "place é obrigatório e não pode estar vazio" }),

  // Rótulo da linha (opcional/nulo)
  lineLabel: z.string().nullable().optional(),

  // Array de motoristas (mínimo 1 e no máximo 2)
  drivers: z
    .array(
      z.object({
        position: z.union([z.literal(1), z.literal(2)]), // posição 1 ou 2
        driverId: z
          .string()
          .trim()
          .uuid({ message: "ID do motorista deve ser um UUID válido" }),
      }),
    )
    .min(1, { message: "Pelo menos um motorista é obrigatório" })
    .max(2, { message: "No máximo dois motoristas são permitidos" }) // Garante limite
    .superRefine((items, ctx) => {
      // Motorista 01 é obrigatório
      const hasDriverPosition1 = items.some((driver) => driver.position === 1);
      if (!hasDriverPosition1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Motorista 01 (position=1) é obrigatório.",
        });
      }

      // Garantir que não há repetição de IDs de motoristas
      const driverIds = items.map((d) => d.driverId);
      if (new Set(driverIds).size !== driverIds.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Não é permitido repetir o mesmo motorista.",
        });
      }
    }),

  // Campo details (opcional) com validação de suas subpropriedades
  details: z
    .object({
      velocidade: z
        .string()
        .regex(/^\d+$/, {
          message:
            "Velocidade deve ser um número em formato de texto (ex: '80')",
        })
        .optional(), // Opcional
      limite: z
        .string()
        .regex(/^\d+$/, {
          message: "Limite deve ser um número em formato de texto (ex: '60')",
        })
        .optional(),
      local: z.string().trim().optional(),
    })
    .optional(), // O próprio campo `details` é opcional
});
