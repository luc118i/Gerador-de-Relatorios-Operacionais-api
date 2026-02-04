import { z } from "zod";

export const createOccurrenceSchema = z.object({
  typeCode: z.string().default("DESCUMP_OP_PARADA_FORA"),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tripDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  vehicleNumber: z.string().min(1),
  baseCode: z.string().min(2),
  lineLabel: z.string().optional(),
  place: z.string().min(3),
  drivers: z
    .array(
      z.object({
        position: z.union([z.literal(1), z.literal(2)]),
        registry: z.string().min(1),
        name: z.string().min(3),
        baseCode: z.string().min(2),
      }),
    )
    .min(1)
    .max(2),
});
