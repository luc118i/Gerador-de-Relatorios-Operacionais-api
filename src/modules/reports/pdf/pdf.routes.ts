import type { Express } from "express";
import { getOccurrencePdfHandler } from "./pdf.route.js";
import { sendOccurrenceToDriveHandler } from "./pdf.drive.route.js";
import { getSuspensaoPdfHandler, getSuspensaoInfoHandler } from "./suspensao.route.js";
import { getDailyReportPdfHandler, sendDailyReportToDriveHandler } from "./daily-report.route.js";
import { getTelemetryReportPdfHandler } from "./telemetry-report.route.js";

export function reportsPdfRoutes(app: Express) {
  app.get("/reports/occurrences/:id/pdf", getOccurrencePdfHandler);
  app.post("/reports/occurrences/:id/drive", sendOccurrenceToDriveHandler);
  app.post("/reports/occurrences/:id/suspensao-pdf", getSuspensaoPdfHandler);
  app.get("/reports/occurrences/:id/suspensao-info", getSuspensaoInfoHandler);
  app.get("/reports/daily/:date/pdf", getDailyReportPdfHandler);
  app.post("/reports/daily/:date/drive", sendDailyReportToDriveHandler);
  app.get("/reports/telemetry/:id/pdf", getTelemetryReportPdfHandler);
}
