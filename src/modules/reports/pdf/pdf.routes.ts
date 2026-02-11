import type { Express } from "express";
import { getOccurrencePdfHandler } from "./pdf.route.js";

export function reportsPdfRoutes(app: Express) {
  app.get("/reports/occurrences/:id/pdf", getOccurrencePdfHandler);
}
