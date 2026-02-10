// src/modules/occurrences/occurrences.schemas.ts
import { z } from "zod";

export const createOccurrenceSchema = z.object({
  typeCode: z.string(),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "eventDate deve ser YYYY-MM-DD"),
  tripDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "tripDate deve ser YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime deve ser HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "endTime deve ser HH:mm"),

  // ✅ derivados
  vehicleNumber: z.string().trim().min(1),

  baseCode: z.string().trim().min(1).optional(),

  // ✅ necessário para derivar vehicleNumber
  tripId: z.string().optional(), // se for uuid, troque pra z.string().uuid().optional()

  place: z.string().trim().min(1),

  lineLabel: z.string().nullable().optional(), // opcional (se quiser)

  drivers: z
    .array(
      z.object({
        position: z.union([z.literal(1), z.literal(2)]),
        driverId: z.string().trim().uuid(),
      }),
    )
    .min(1)
    .max(2)
    .superRefine((items, ctx) => {
      const has1 = items.some((d) => d.position === 1);
      if (!has1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Motorista 01 (position=1) é obrigatório.",
        });
      }

      const ids = items.map((d) => d.driverId);
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Não é permitido repetir o mesmo motorista.",
        });
      }
    }),
});
