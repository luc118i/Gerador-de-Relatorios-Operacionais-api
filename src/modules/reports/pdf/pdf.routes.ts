import type { Express } from "express";
import { getOccurrencePdfHandler } from "./pdf.route.js";
import { getGroupOccurrencesPdfHandler } from "./pdf.group.route.js";
import { getOccurrenceDocxHandler } from "./docx.route.js";
import { sendOccurrenceToDriveHandler } from "./pdf.drive.route.js";
import { getSuspensaoPdfHandler, getSuspensaoInfoHandler } from "./suspensao.route.js";
import { getDailyReportPdfHandler, sendDailyReportToDriveHandler } from "./daily-report.route.js";
import { getTelemetryReportPdfHandler } from "./telemetry-report.route.js";
import { getExcessoParadaReportPdfHandler } from "./excesso-parada.route.js";
import { getExcessoParadaManualPdfHandler } from "./excesso-parada-manual.route.js";
import { getSolicitacaoMudancaPdfHandler } from "./solicitacao-mudanca.route.js";

export function reportsPdfRoutes(app: Express) {
  // Precisa vir antes de "/reports/occurrences/:id/pdf" só por clareza —
  // como o path é diferente ("occurrences-group", não "occurrences/:id"),
  // não há colisão de rota real, mas mantém as duas juntas no arquivo.
  app.get("/reports/occurrences-group/pdf", getGroupOccurrencesPdfHandler);
  app.get("/reports/occurrences/:id/pdf", getOccurrencePdfHandler);
  app.get("/reports/occurrences/:id/docx", getOccurrenceDocxHandler);
  app.post("/reports/occurrences/:id/drive", sendOccurrenceToDriveHandler);
  app.post("/reports/occurrences/:id/suspensao-pdf", getSuspensaoPdfHandler);
  app.get("/reports/occurrences/:id/suspensao-info", getSuspensaoInfoHandler);
  app.get("/reports/daily/:date/pdf", getDailyReportPdfHandler);
  app.post("/reports/daily/:date/drive", sendDailyReportToDriveHandler);
  app.get("/reports/telemetry/:id/pdf", getTelemetryReportPdfHandler);
  app.get("/reports/telemetry/:id/excesso-parada-pdf", getExcessoParadaReportPdfHandler);
  app.post("/reports/excesso-parada", getExcessoParadaManualPdfHandler);
  app.post("/reports/solicitacao-mudanca", getSolicitacaoMudancaPdfHandler);
}
