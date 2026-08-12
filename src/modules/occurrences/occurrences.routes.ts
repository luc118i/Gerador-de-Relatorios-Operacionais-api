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
  incrementWhatsappSent,
  listReportTitles,
  updateTratativa,
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
      const result = await createOccurrence(payload);
      const id = typeof result === "string" ? result : result.id;
      const paradaForaIds = typeof result === "object" ? result.paradaForaIds : undefined;
      res.status(201).json({ id, ...(paradaForaIds ? { paradaForaIds } : {}) });
    } catch (err) {
      next(err);
    }
  });

  // Must be before /:id to avoid Express matching "report-titles" as id
  app.get("/occurrences/report-titles", async (_req, res) => {
    try {
      const titles = await listReportTitles();
      res.json({ data: titles });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch report titles" });
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

  // PATCH tratativa/analista (atualização parcial)
  app.patch("/occurrences/:id/tratativa", async (req, res, next) => {
    try {
      const { id } = req.params;
      const { tratativa, analisadoPor, analisadoPorUserId, justificativaRegistro } = req.body as {
        tratativa?: string | null;
        analisadoPor?: string | null;
        analisadoPorUserId?: string | null;
        justificativaRegistro?: string | null;
      };
      const VALID = ["SUSPEICAO", "ADVERTENCIA", "VALE", "REGISTRO", null, undefined];
      if (!VALID.includes(tratativa as any)) {
        return res.status(400).json({ error: "tratativa inválida" });
      }
      await updateTratativa(
        id,
        tratativa ?? null,
        analisadoPor ?? null,
        justificativaRegistro ?? null,
        // Preserva undefined quando a chave nem veio no body (clientes
        // antigos, sem essa feature) — ver comentário em updateTratativa.
        analisadoPorUserId,
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // Registra que a notificação via WhatsApp foi enviada (incrementa o
  // contador) — chamado pelo frontend depois de whatsappAgentApi.send() dar
  // certo, não antes (não conta tentativa falha).
  app.post("/occurrences/:id/whatsapp-sent", async (req, res, next) => {
    try {
      const { id } = req.params;
      const position = Number(req.body?.driverPosition);
      if (position !== 1 && position !== 2) {
        return res.status(400).json({ error: "driverPosition deve ser 1 ou 2" });
      }
      const result = await incrementWhatsappSent(id, position);
      res.json({ data: result });
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
