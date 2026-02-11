import type { Express } from "express";

import { occurrencesRoutes } from "../../modules/occurrences/occurrences.routes.js";
import { reportsRoutes } from "../../modules/reports/reports.routes.js";
import { evidencesRoutes } from "../../modules/evidences/evidences.routes.js";
import { reportsPdfRoutes } from "../../modules/reports/pdf/pdf.routes.js";
import { driversRoutes } from "../../modules/drivers/drivers.routes.js";

export function registerRoutes(app: Express) {
  occurrencesRoutes(app);
  driversRoutes(app);
  reportsRoutes(app);
  evidencesRoutes(app);
  reportsPdfRoutes(app);
}
