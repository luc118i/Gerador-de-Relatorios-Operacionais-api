import type { Request, Response } from "express";
import { z } from "zod";
import { buildGroupOccurrencesPdf } from "./pdf.service.js";
import { AppError } from "./pdf.errors.js";

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);

const QuerySchema = z.object({
  ids: z.preprocess(
    first,
    z.string().min(1, "ids é obrigatório (lista separada por vírgula)"),
  ),
  force: z.preprocess(first, z.enum(["1", "true", "0", "false"]).optional()),
  ttl: z.preprocess(
    first,
    z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .refine((n) => n >= 60 && n <= 86400, "ttl deve estar entre 60 e 86400 segundos")
      .optional(),
  ),
});

// Um único PDF cobrindo várias ocorrências de EXCESSO_PERMANENCIA (mesmo
// veículo/viagem, um ponto por ocorrência) — usado pelo "Gerar Relatório" em
// grupo de tempo_permanencia.html, que cria N ocorrências (uma por parada)
// mas só precisa de 1 PDF consolidado no final.
export async function getGroupOccurrencesPdfHandler(req: Request, res: Response) {
  try {
    const q = QuerySchema.parse(req.query);
    const occurrenceIds = q.ids.split(",").map((s) => s.trim()).filter(Boolean);
    const force = q.force === "1" || q.force === "true";

    const result = await buildGroupOccurrencesPdf({
      occurrenceIds,
      force,
      maxPhotos: 20,
      ...(q.ttl !== undefined ? { ttlSeconds: q.ttl } : {}),
    });

    return res.status(200).json({
      data: {
        occurrenceIds,
        pdf: {
          storagePath: result.pdfStoragePath,
          signedUrl: result.signedUrl,
          ttlSeconds: result.ttlSeconds,
          cached: result.cached,
        },
      },
    });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res.status(400).json({
        error: { message: "Parâmetros inválidos", details: err.errors },
      });
    }
    if (err instanceof AppError) {
      return res.status(err.status).json({
        error: { code: err.code, message: err.message },
      });
    }
    console.error("[getGroupOccurrencesPdfHandler] erro inesperado:", err);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Erro inesperado" },
    });
  }
}
