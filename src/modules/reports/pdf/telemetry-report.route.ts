import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { findAnalysisById } from "../../telemetry/repositories/telemetry-analyses.repo.js";
import { buildTelemetryReportHtml } from "./telemetry-report.template.js";
import { renderPdfFromHtml } from "./pdf.puppeteer.js";
import { uploadPrivatePdf, createSignedUrl, pdfExists, deleteStorageFile } from "./pdf.storage.js";
import { AppError } from "./pdf.errors.js";

const BUCKET = "reports";

const querySchema = z.object({
  force: z.enum(["0", "1", "true", "false"]).optional().transform(v => v === "1" || v === "true"),
  ttl:   z.coerce.number().int().min(60).max(86400).optional().default(3600),
});

export async function getTelemetryReportPdfHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const query = querySchema.parse(req.query);

    const row = await findAnalysisById(id);
    if (!row) throw new AppError(404, "Análise não encontrada.", "ANALYSIS_NOT_FOUND");

    const storagePath = `telemetry/${id}.pdf`;

    // Retorna cache salvo, a não ser que force=true
    if (!query.force && await pdfExists(BUCKET, storagePath)) {
      const url = await createSignedUrl(BUCKET, storagePath, query.ttl);
      return res.json({ url, cached: true });
    }

    if (query.force) {
      await deleteStorageFile(BUCKET, storagePath);
    }

    const html   = buildTelemetryReportHtml(row);
    const buffer = await renderPdfFromHtml(html);

    await uploadPrivatePdf(BUCKET, storagePath, buffer);

    const url = await createSignedUrl(BUCKET, storagePath, query.ttl);
    return res.json({ url, cached: false });
  } catch (err) {
    next(err);
  }
}
