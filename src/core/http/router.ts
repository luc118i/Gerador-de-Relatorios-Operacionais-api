import type { Express } from "express";

import { occurrencesRoutes } from "../../modules/occurrences/occurrences.routes.js";
import { reportsRoutes } from "../../modules/reports/reports.routes.js";
import { evidencesRoutes } from "../../modules/evidences/evidences.routes.js";
import { reportsPdfRoutes } from "../../modules/reports/pdf/pdf.routes.js";
import { driversRoutes } from "../../modules/drivers/drivers.routes.js";
import { aiRoutes } from "../../modules/ai/ai.routes.js";
import { tripsRoutes } from "../../modules/trips/trips.routes.js";
import { automationRoutes } from "../../modules/automation/automation.routes.js";
import { presetsRoutes } from "../../modules/presets/presets.routes.js";

export function registerRoutes(app: Express) {
  occurrencesRoutes(app);
  driversRoutes(app);
  tripsRoutes(app);
  reportsRoutes(app);
  evidencesRoutes(app);
  reportsPdfRoutes(app);
  aiRoutes(app);
  automationRoutes(app);
  presetsRoutes(app);
}
