import type { Express } from "express";

import { createOccurrenceSchema } from "./occurrences.schemas";
import { createOccurrence, getOccurrencesByDay } from "./occurrences.service";

export function occurrencesRoutes(app: Express) {
  app.get("/occurrences", async (req, res) => {
    const date = String(req.query.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }
    const data = await getOccurrencesByDay(date);
    res.json({ data });
  });

  app.post("/occurrences", async (req, res) => {
    const payload = createOccurrenceSchema.parse(req.body);
    const id = await createOccurrence(payload);
    res.status(201).json({ id });
  });
}
