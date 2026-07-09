// src/modules/trips/trips.schemas.ts
import { z } from "zod";

export const listTripsSchema = z.object({
  search: z.string().optional(),
});

export const lookupTripSchema = z
  .object({
    lineCode:      z.string().optional(),
    lineName:      z.string().optional(),
    departureTime: z.string().min(1, "departureTime é obrigatório"),
    direction:     z.string().optional(),
  })
  .refine((v) => !!(v.lineCode?.trim() || v.lineName?.trim()), {
    message: "Informe lineCode ou lineName",
    path: ["lineCode"],
  });

export const createTripSchema = z.object({
  lineCode: z.string().min(1, "Código da linha é obrigatório"),
  lineName: z.string().min(1, "Nome da linha é obrigatório"),
  departureTime: z.string().min(1, "Horário de partida é obrigatório"),
  direction: z.string().default(""),
});
