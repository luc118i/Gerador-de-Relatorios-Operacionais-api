// src/modules/disciplinary/disciplinary.routes.ts
import type { Express } from "express";
import { monthlyOccurrencesQuerySchema } from "./disciplinary.schemas.js";
import {
  getDriverSituation,
  getDriverMonthlyOccurrences,
  getDashboardSummary,
  getDriverOccurrenceHistory,
} from "./disciplinary.service.js";
import { getDriverConductPdfHandler } from "./driver-conduct.route.js";
import { compareDriverWithRizer } from "./rizer-compare.service.js";

export function disciplinaryRoutes(app: Express) {
  // BI geral: totais, ocorrências por base e ranking dos piores motoristas.
  app.get("/dashboard/motoristas", async (_req, res, next) => {
    try {
      const data = await getDashboardSummary();
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  // Situação disciplinar atual do motorista (REGULAR/ATENCAO/CRITICO) + índice.
  // Fonte: view driver_disciplinary_index — fórmula documentada em disciplinary.service.ts.
  app.get("/drivers/:id/situation", async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = await getDriverSituation(id);
      if (!data) {
        return res
          .status(404)
          .json({ error: { code: "NOT_FOUND", message: "Motorista não encontrado" } });
      }
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  // Evolução mensal de ocorrências do motorista (gráfico "Evolução" do perfil).
  app.get("/drivers/:id/monthly-occurrences", async (req, res, next) => {
    try {
      const { id } = req.params;
      const { months } = monthlyOccurrencesQuerySchema.parse(req.query);
      const data = await getDriverMonthlyOccurrences(id, months);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  // Histórico de ocorrências do motorista (seção "Histórico Disciplinar" do perfil).
  app.get("/drivers/:id/occurrences", async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = await getDriverOccurrenceHistory(id);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  // Ficha de Conduta em PDF (relatório disciplinar consolidado do motorista).
  app.get("/reports/drivers/:id/conduct-pdf", getDriverConductPdfHandler);

  // Compara contagem de ocorrências por tipo contra a listagem do RIZER
  // (busca por matrícula). Não é auditoria 1:1 — ver rizer-compare.service.ts.
  // Automação de browser real contra o RIZER: ~10-30s de resposta.
  app.post("/drivers/:id/rizer-check", async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = await compareDriverWithRizer(id);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });
}
