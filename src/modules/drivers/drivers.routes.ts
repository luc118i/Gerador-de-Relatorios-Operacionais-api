// src/modules/drivers/drivers.routes.ts
import type { Express } from "express";
import { createDriverSchema, searchDriversSchema } from "./drivers.schemas.js";
import { createDriver, listDrivers } from "./drivers.service.js";

export function driversRoutes(app: Express) {
  app.get("/drivers", async (req, res) => {
    const parsed = searchDriversSchema.parse(req.query);

    const data = await listDrivers({
      ...(parsed.search ? { search: parsed.search } : {}),
      ...(parsed.active !== undefined
        ? { active: parsed.active === "true" }
        : {}),
      limit: parsed.limit,
    });

    res.json({ data });
  });

  app.post("/drivers", async (req, res, next) => {
    try {
      const payloadRaw = createDriverSchema.parse(req.body);
      const payload = {
        code: payloadRaw.code,
        name: payloadRaw.name,
        ...(payloadRaw.base !== undefined ? { base: payloadRaw.base } : {}),
      };
      const id = await createDriver(payload);
      res.status(201).json({ id });
    } catch (err) {
      next(err);
    }
  });
}
