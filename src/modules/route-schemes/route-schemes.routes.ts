import type { Express } from "express";
import {
  listSchemesSchema,
  createSchemeSchema,
  updateSchemeSchema,
  replacePointsSchema,
  upsertSpeedConfigSchema,
} from "./route-schemes.schemas.js";
import {
  listSchemes,
  getScheme,
  createScheme,
  updateScheme,
  deleteScheme,
  getSchemePoints,
  setSchemePoints,
  getSpeedConfig,
  setSpeedConfig,
} from "./route-schemes.service.js";

export function routeSchemesRoutes(app: Express) {
  // ─── Schemes ──────────────────────────────────────────────────────────────

  app.get("/route-schemes", async (req, res, next) => {
    try {
      const parsed = listSchemesSchema.parse(req.query);
      const data = await listSchemes({
        ...(parsed.search ? { search: parsed.search } : {}),
        active: parsed.active === "true",
      });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  app.post("/route-schemes", async (req, res, next) => {
    try {
      const payload = createSchemeSchema.parse(req.body);
      const created = await createScheme(payload);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  app.get("/route-schemes/:id", async (req, res, next) => {
    try {
      const scheme = await getScheme(req.params.id);
      if (!scheme) return res.status(404).json({ message: "Esquema não encontrado" });
      return res.json(scheme);
    } catch (err) {
      next(err);
    }
  });

  app.put("/route-schemes/:id", async (req, res, next) => {
    try {
      const payload = updateSchemeSchema.parse(req.body);
      const updated = await updateScheme(req.params.id, payload);
      if (!updated) return res.status(404).json({ message: "Esquema não encontrado" });
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  app.delete("/route-schemes/:id", async (req, res, next) => {
    try {
      const deleted = await deleteScheme(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Esquema não encontrado" });
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // ─── Points ───────────────────────────────────────────────────────────────

  app.get("/route-schemes/:id/points", async (req, res, next) => {
    try {
      const data = await getSchemePoints(req.params.id);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  app.put("/route-schemes/:id/points", async (req, res, next) => {
    try {
      const payload = replacePointsSchema.parse(req.body);
      const data = await setSchemePoints(req.params.id, payload);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  // ─── Speed Config ─────────────────────────────────────────────────────────

  app.get("/route-schemes/:id/speed-config", async (req, res, next) => {
    try {
      const data = await getSpeedConfig(req.params.id);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  app.put("/route-schemes/:id/speed-config", async (req, res, next) => {
    try {
      const payload = upsertSpeedConfigSchema.parse(req.body);
      const data = await setSpeedConfig(req.params.id, payload);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });
}
