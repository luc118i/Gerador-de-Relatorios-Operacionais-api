// src/modules/occurrences/occurrences.schemas.ts
import { z } from "zod";

export const createOccurrenceSchema = z.object({
  typeCode: z.string(),
  eventDate: z.string(),
  tripDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  vehicleNumber: z.string(),
  baseCode: z.string(),
  place: z.string(),

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
