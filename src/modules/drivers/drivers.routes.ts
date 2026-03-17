// src/modules/drivers/drivers.routes.ts
import type { Express } from "express";
import {
  createDriverSchema,
  searchDriversSchema,
  updateDriverSchema,
  type UpdateDriverInput,
} from "./drivers.schemas.js";
import {
  createDriver,
  listDrivers,
  updateDriver,
  deleteDriver,
} from "./drivers.service.js";

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

  app.patch("/drivers/:id", async (req, res, next) => {
    try {
      const { id } = req.params;

      const parsed = updateDriverSchema.parse(req.body) as UpdateDriverInput;

      // normalizar removendo undefined
      const payload: {
        code?: string;
        name?: string;
        base?: string | null;
      } = {};

      if (parsed.code !== undefined) {
        payload.code = parsed.code;
      }
      if (parsed.name !== undefined) {
        payload.name = parsed.name;
      }
      if (parsed.base !== undefined) {
        payload.base = parsed.base ?? null;
      }

      const updated = await updateDriver(id, payload);

      if (!updated) {
        return res.status(404).json({ message: "Driver not found" });
      }

      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  app.delete("/drivers/:id", async (req, res, next) => {
    try {
      const { id } = req.params;

      const deleted = await deleteDriver(id);

      if (!deleted) {
        return res.status(404).json({ message: "Driver not found" });
      }

      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  });
}
