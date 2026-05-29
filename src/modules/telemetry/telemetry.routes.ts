import type { Express } from "express";
import { analyzeQuerySchema, listAnalysesQuerySchema } from "./telemetry.schemas.js";
import { analyzeCSV } from "./telemetry.service.js";
import { listAnalyses, findAnalysisById } from "./repositories/telemetry-analyses.repo.js";

export function telemetryRoutes(app: Express) {
  /**
   * POST /telemetry/analyze
   * Body: text/plain (conteúdo bruto do CSV)
   * Query: ?schemeId=<uuid> (opcional)
   *
   * Processa, persiste e retorna análise completa com id gerado.
   */
  app.post("/telemetry/analyze", async (req, res, next) => {
    try {
      const query = analyzeQuerySchema.parse(req.query);

      const csvText: string =
        typeof req.body === "string"
          ? req.body
          : Buffer.isBuffer(req.body)
          ? req.body.toString("utf-8")
          : JSON.stringify(req.body);

      if (!csvText || csvText.trim() === "") {
        return res.status(400).json({ message: "Corpo da requisição está vazio. Envie o conteúdo CSV como texto." });
      }

      const result = await analyzeCSV(csvText, {
        ...(query.schemeId ? { schemeId: query.schemeId } : {}),
      });

      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /telemetry/analyses
   * Query: ?veiculo=&motorista=&dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD&page=1&limit=20
   *
   * Lista histórico de análises (sem points/segments/alerts para economizar payload).
   */
  app.get("/telemetry/analyses", async (req, res, next) => {
    try {
      const query = listAnalysesQuerySchema.parse(req.query);

      const { data, total } = await listAnalyses({
        veiculo:    query.veiculo,
        motorista:  query.motorista,
        dataInicio: query.dataInicio,
        dataFim:    query.dataFim,
        page:       query.page,
        limit:      query.limit,
      });

      return res.json({
        data,
        meta: {
          total,
          page:       query.page,
          limit:      query.limit,
          totalPages: Math.ceil(total / query.limit),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /telemetry/analyses/:id
   *
   * Retorna análise completa (incluindo points, segments, alerts, comparison).
   */
  app.get("/telemetry/analyses/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      const row = await findAnalysisById(id);

      if (!row) {
        return res.status(404).json({ message: "Análise não encontrada." });
      }

      return res.json(row);
    } catch (err) {
      next(err);
    }
  });
}
