// src/modules/disciplinary/driver-conduct.route.ts
import type { Request, Response } from "express";
import { getDriverById } from "../drivers/drivers.repo.js";
import {
  getDriverSituation,
  getDriverMonthlyOccurrences,
  getDriverOccurrenceHistory,
} from "./disciplinary.service.js";
import { buildDriverConductPdfHtml } from "./driver-conduct.template.js";
import { renderPdfFromHtml } from "../reports/pdf/pdf.puppeteer.js";
import { getLogoDataUri } from "../reports/pdf/pdf.assets.js";
import { AppError } from "../reports/pdf/pdf.errors.js";

// Ficha de conduta completa: até 200 ocorrências no relatório (bem acima do
// máximo que a retenção de 90 dias consegue acumular na prática — ver
// purge_occurrences_last_month no banco).
const CONDUCT_HISTORY_LIMIT = 200;

function buildConductFileName(driverName: string, driverCode: string): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ".");
  const shortName = driverName.split(" ").slice(0, 3).join(" ");
  return `${driverCode} - ${shortName} - FICHA DE CONDUTA - ${dateStr}.pdf`;
}

export async function getDriverConductPdfHandler(req: Request, res: Response) {
  try {
    const driverId = req.params.id;
    if (typeof driverId !== "string" || !driverId) {
      throw new AppError(400, "Parâmetro :id inválido", "BAD_DRIVER_ID");
    }

    const driver = await getDriverById(driverId);
    if (!driver) {
      throw new AppError(404, "Motorista não encontrado", "DRIVER_NOT_FOUND");
    }

    const [situation, monthly, history] = await Promise.all([
      getDriverSituation(driverId),
      getDriverMonthlyOccurrences(driverId, 3),
      getDriverOccurrenceHistory(driverId, CONDUCT_HISTORY_LIMIT),
    ]);

    const logoDataUri = getLogoDataUri();
    const html = buildDriverConductPdfHtml({
      driver,
      situation,
      monthly,
      history,
      logoDataUri,
    });

    const pdfBuffer = await renderPdfFromHtml(html);
    const fileName = buildConductFileName(driver.name, driver.code);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err: any) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }
    console.error("[getDriverConductPdfHandler] erro:", err);
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Erro inesperado" } });
  }
}
