import type { Request, Response } from "express";
import { z } from "zod";
import { buildOccurrencePdf } from "./pdf.service.js";
import { AppError } from "./pdf.errors.js";

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);

const QuerySchema = z.object({
  force: z.preprocess(first, z.enum(["1", "true", "0", "false"]).optional()),
  ttl: z.preprocess(
    first,
    z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .refine(
        (n) => n >= 60 && n <= 86400,
        "ttl deve estar entre 60 e 86400 segundos",
      )
      .optional(),
  ),
});

export async function getOccurrencePdfHandler(req: Request, res: Response) {
  try {
    const occurrenceIdRaw = req.params.id;

    if (typeof occurrenceIdRaw !== "string") {
      throw new AppError(400, "Parâmetro :id inválido", "BAD_OCCURRENCE_ID");
    }

    const occurrenceId = occurrenceIdRaw;

    const q = QuerySchema.parse(req.query);
    const force = q.force === "1" || q.force === "true";
    const ttlSeconds = q.ttl;

    const result = await buildOccurrencePdf({
      occurrenceId,
      force,
      maxPhotos: 20,
      ...(ttlSeconds !== undefined ? { ttlSeconds } : {}),
    });

    return res.status(200).json({
      data: {
        occurrenceId,
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
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Erro inesperado" },
    });
  }
}
