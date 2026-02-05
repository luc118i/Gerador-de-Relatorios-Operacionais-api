import type { Express } from "express";

import { buildDailyReport } from "./reports.service";

export function reportsRoutes(app: Express) {
  app.get("/reports/daily", async (req, res) => {
    const date = String(req.query.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }

    const result = await buildDailyReport(date);
    res.json(result);
  });
}
