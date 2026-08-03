import type { Express } from "express";
import { createBaseResponsavelSchema, updateBaseResponsavelSchema } from "./base-responsaveis.schemas.js";
import {
  listBaseResponsaveis,
  createBaseResponsavel,
  updateBaseResponsavel,
  deleteBaseResponsavel,
} from "./base-responsaveis.repo.js";

export function baseResponsaveisRoutes(app: Express) {
  app.get("/base-responsaveis", async (_req, res, next) => {
    try {
      const data = await listBaseResponsaveis();
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  app.post("/base-responsaveis", async (req, res, next) => {
    try {
      const parsed = createBaseResponsavelSchema.parse(req.body);
      const created = await createBaseResponsavel(parsed);
      res.status(201).json({ data: created });
    } catch (err: any) {
      if (err?.code === "23505") {
        return res.status(409).json({ error: "Sigla já cadastrada." });
      }
      next(err);
    }
  });

  app.patch("/base-responsaveis/:sigla", async (req, res, next) => {
    try {
      const parsed = updateBaseResponsavelSchema.parse(req.body);
      const updated = await updateBaseResponsavel(req.params.sigla, parsed);
      if (!updated) {
        return res.status(404).json({ error: "Base não encontrada." });
      }
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  });

  app.delete("/base-responsaveis/:sigla", async (req, res, next) => {
    try {
      await deleteBaseResponsavel(req.params.sigla);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });
}
