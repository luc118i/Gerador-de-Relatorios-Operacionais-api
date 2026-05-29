import { z } from "zod";

export const analyzeQuerySchema = z.object({
  schemeId: z.string().uuid().optional(),
});

export const listAnalysesQuerySchema = z.object({
  veiculo:    z.string().optional(),
  motorista:  z.string().optional(),
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD").optional(),
  dataFim:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD").optional(),
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
});

export type AnalyzeQueryInput      = z.infer<typeof analyzeQuerySchema>;
export type ListAnalysesQueryInput = z.infer<typeof listAnalysesQuerySchema>;
