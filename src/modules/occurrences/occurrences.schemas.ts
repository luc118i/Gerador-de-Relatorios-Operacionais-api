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
        registry: z.string(),
        name: z.string(),
        baseCode: z.string(),
      }),
    )
    .min(1)
    .max(2),
});
