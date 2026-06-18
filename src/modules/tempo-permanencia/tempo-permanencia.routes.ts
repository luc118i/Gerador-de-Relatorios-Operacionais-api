import type { Express } from "express";
import { z } from "zod";
import { listTempoPermanencia } from "../telemetry/repositories/tempo-permanencia.repo.js";

const querySchema = z.object({
  search: z.string().trim().min(1).optional(),
});

export function tempoPermanenciaRoutes(app: Express) {
  app.get("/tempo-permanencia", async (req, res, next) => {
    try {
      const parsed = querySchema.parse(req.query);
      const data = await listTempoPermanencia(parsed.search);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });
}
