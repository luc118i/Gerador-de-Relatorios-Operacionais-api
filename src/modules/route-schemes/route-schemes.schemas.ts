import { z } from "zod";

export const listSchemesSchema = z.object({
  search: z.string().optional(),
  active: z.union([z.literal("true"), z.literal("false")]).optional().default("true"),
});

export const createSchemeSchema = z.object({
  tripId: z.string().uuid().optional().nullable(),
  nomeLinha: z.string().min(1).max(200),
  horario: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Formato esperado: HH:MM ou HH:MM:SS")
    .optional()
    .nullable(),
  sentido: z.string().max(50).optional().nullable(),
});

export const updateSchemeSchema = z
  .object({
    tripId: z.string().uuid().optional().nullable(),
    nomeLinha: z.string().min(1).max(200).optional(),
    horario: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Formato esperado: HH:MM ou HH:MM:SS")
      .optional()
      .nullable(),
    sentido: z.string().max(50).optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "Pelo menos um campo deve ser enviado para atualização.",
  });

const schemePointSchema = z.object({
  ordem: z.number().int().min(1),
  localId: z.number().int().optional().nullable(),
  nomePonto: z.string().min(1).max(200),
  tipo: z.string().max(50).optional().nullable(),
  horarioComercial: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .optional()
    .nullable(),
  tempoLocalMin: z.number().int().min(0).optional().nullable(),
  tipoTrecho: z.string().max(50).optional().nullable(),
});

export const replacePointsSchema = z.object({
  points: z.array(schemePointSchema).min(0),
});

const speedConfigEntrySchema = z.object({
  tipoVia: z.enum(["BR", "Est", "Mun", "Urb"]),
  velKmh: z.number().int().min(1).max(200),
});

export const upsertSpeedConfigSchema = z.object({
  configs: z.array(speedConfigEntrySchema).min(1),
});

export type CreateSchemeInput = z.infer<typeof createSchemeSchema>;
export type UpdateSchemeInput = z.infer<typeof updateSchemeSchema>;
export type ReplacePointsInput = z.infer<typeof replacePointsSchema>;
export type UpsertSpeedConfigInput = z.infer<typeof upsertSpeedConfigSchema>;
