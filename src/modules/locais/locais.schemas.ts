import { z } from "zod";

export const searchLocaisSchema = z.object({
  search: z.string().optional(),
});

export const createLocalSchema = z.object({
  nome: z.string().min(1),
  sigla: z.string().optional().nullable(),
  tipo: z.string().optional().nullable(),
  lat: z.coerce.number().optional().nullable(),
  lng: z.coerce.number().optional().nullable(),
});
