import { Router } from "express";
import type { Express } from "express";
import { buildDailyReport } from "./reports.service.js";

const router = Router();

router.get("/reports/daily", async (req, res) => {
  const date = req.query.date;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  }

  const result = await buildDailyReport(date);
  return res.json(result);
});

export function reportsRoutes(app: Express) {
  app.get("/reports/daily", async (req, res) => {
    const dateRaw = req.query.date;

    if (typeof dateRaw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }

    const result = await buildDailyReport(dateRaw);
    res.json(result);
  });
}

export default router;
