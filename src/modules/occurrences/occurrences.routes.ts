import type { Express } from "express";

import { createOccurrenceSchema } from "./occurrences.schemas.js";
import {
  createOccurrence,
  updateOccurrence,
  getOccurrencesByDay,
} from "./occurrences.service.js";

import {
  deleteOccurrence,
  getOccurrenceById,
} from "./occurrences.repo.js";

export function occurrencesRoutes(app: Express) {
  // 1. Rota de Listagem (Mantenha apenas uma)
  app.get("/occurrences", async (req, res) => {
    const date = String(req.query.date || req.query.reportDate || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }
    const data = await getOccurrencesByDay(date);
    res.json({ data });
  });

  // 2. Rota de Criação
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
    try {
      const { id } = req.params;
      const data = await getOccurrenceById(id);

      if (!data) {
        return res.status(404).json({ error: "Occurrence not found" });
      }

      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/occurrences/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      const payload = createOccurrenceSchema.parse(req.body);
      await updateOccurrence(id, payload);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  app.delete("/occurrences/:id", async (req, res) => {
    try {
      await deleteOccurrence(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Erro ao deletar ocorrência" });
    }
  });
}
