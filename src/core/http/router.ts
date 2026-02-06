import type { Express } from "express";

import { occurrencesRoutes } from "../../modules/occurrences/occurrences.routes";
import { reportsRoutes } from "../../modules/reports/reports.routes";
import { evidencesRoutes } from "../../modules/evidences/evidences.routes";
import { reportsPdfRoutes } from "../../modules/reports/pdf/pdf.routes";

export function registerRoutes(app: Express) {
  occurrencesRoutes(app);
  reportsRoutes(app);
  evidencesRoutes(app);
  reportsPdfRoutes(app);
}
