// src/modules/disciplinary/disciplinary.schemas.ts
import { z } from "zod";

export const monthlyOccurrencesQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).optional().default(6),
});
