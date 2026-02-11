import type { Express } from "express";

import { createOccurrenceSchema } from "./occurrences.schemas.js";
import {
  createOccurrence,
  getOccurrencesByDay,
} from "./occurrences.service.js";

import { getOccurrenceById } from "./occurrences.repo.js";

export function occurrencesRoutes(app: Express) {
  app.get("/occurrences", async (req, res) => {
    const date = String(req.query.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }
    const data = await getOccurrencesByDay(date);
    res.json({ data });
  });

  app.post("/occurrences", async (req, res, next) => {
    try {
      const payload = createOccurrenceSchema.parse(req.body);
      const id = await createOccurrence(payload);
      res.status(201).json({ id });
    } catch (err) {
      next(err);
    }
  });

  app.get("/occurrences/:id", async (req, res) => {
    const { id } = req.params;
    const occurrence = await getOccurrenceById(id);
    res.json({ data: occurrence });
  });
}
