import type { Request, Response } from "express";
import { listOccurrencesByDay } from "../../occurrences/occurrences.repo.js";
import { buildDailyReportPdfHtml } from "./daily-report.template.js";
import { renderPdfFromHtml } from "./pdf.puppeteer.js";
import { getLogoDataUri } from "./pdf.assets.js";
import { AppError } from "./pdf.errors.js";

export async function getDailyReportPdfHandler(req: Request, res: Response) {
  try {
    const date = String(req.params.date ?? "");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: { code: "BAD_DATE", message: "date deve ser YYYY-MM-DD" } });
    }

    const occurrences = await listOccurrencesByDay(date);
    const logoDataUri = getLogoDataUri();

    const html = buildDailyReportPdfHtml({ occurrences, date, logoDataUri });
    const pdfBuffer = await renderPdfFromHtml(html);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="relatorio-diario-${date}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err: any) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }
    console.error("[getDailyReportPdfHandler] erro:", err);
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Erro inesperado" } });
  }
}
