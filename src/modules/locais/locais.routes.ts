import type { Express } from "express";
import { searchLocaisSchema } from "./locais.schemas.js";
import { listLocais } from "./locais.service.js";

export function locaisRoutes(app: Express) {
  app.get("/locais", async (req, res, next) => {
    try {
      const parsed = searchLocaisSchema.parse(req.query);
      const data = await listLocais({
        ...(parsed.search ? { search: parsed.search } : {}),
      });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });
}
