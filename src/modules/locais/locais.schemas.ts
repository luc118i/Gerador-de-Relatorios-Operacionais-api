import { z } from "zod";

export const searchLocaisSchema = z.object({
  search: z.string().optional(),
});
