import type { Express } from "express";
import { getOccurrencePdfHandler } from "./pdf.route.js";
import { sendOccurrenceToDriveHandler } from "./pdf.drive.route.js";
import { getSuspensaoPdfHandler } from "./suspensao.route.js";

export function reportsPdfRoutes(app: Express) {
  app.get("/reports/occurrences/:id/pdf", getOccurrencePdfHandler);
  app.post("/reports/occurrences/:id/drive", sendOccurrenceToDriveHandler);
  app.post("/reports/occurrences/:id/suspensao-pdf", getSuspensaoPdfHandler);
}
