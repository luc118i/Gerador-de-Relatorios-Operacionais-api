import type { Express } from "express";

import {
  getPublicOccurrence,
  getShare,
  patchShare,
  rotateShare,
} from "./occurrence-shares.service.js";

const asSections = (v: unknown): Record<string, boolean> | undefined => {
  if (!v || typeof v !== "object") return undefined;
  const out: Record<string, boolean> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "boolean") out[k] = val;
  }
  return out;
};

export function occurrenceSharesRoutes(app: Express) {
  // Share atual da ocorrência (uso interno da Ficha).
  app.get("/occurrences/:id/share", async (req, res, next) => {
    try {
      res.json({ data: await getShare(req.params.id) });
    } catch (err) {
      next(err);
    }
  });

  // Gera (ou regenera) o link público — revoga o anterior.
  app.post("/occurrences/:id/share", async (req, res, next) => {
    try {
      const createdBy = String(req.body?.createdBy ?? "").trim() || null;
      const sections = asSections(req.body?.sections);
      res.json({ data: await rotateShare(req.params.id, createdBy, sections) });
    } catch (err) {
      next(err);
    }
  });

  // Ativa/inativa ou muda as seções visíveis.
  app.patch("/shares/:token", async (req, res, next) => {
    try {
      const patch: { active?: boolean; sections?: Record<string, boolean> } = {};
      if (typeof req.body?.active === "boolean") patch.active = req.body.active;
      const sections = asSections(req.body?.sections);
      if (sections) patch.sections = sections;
      res.json({ data: await patchShare(req.params.token, patch) });
    } catch (err) {
      next(err);
    }
  });

  // View pública — sem auth. 404 para token inexistente/inativo.
  app.get("/public/occurrences/:token", async (req, res, next) => {
    try {
      res.json({ data: await getPublicOccurrence(req.params.token) });
    } catch (err) {
      next(err);
    }
  });
}
