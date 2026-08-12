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
  lookupDriver,
  getDriver,
  updateDriver,
  deleteDriver,
  upsertDriver,
  getDriverStats,
} from "./drivers.service.js";

export function driversRoutes(app: Express) {
  app.get("/drivers/lookup", async (req, res, next) => {
    try {
      const code = String(req.query.code ?? "").trim();
      if (!code) return res.status(400).json({ message: "code é obrigatório" });
      const driver = await lookupDriver(code);
      if (!driver) return res.status(404).json({ message: "Motorista não encontrado" });
      return res.json(driver);
    } catch (err) {
      next(err);
    }
  });

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
        ...(payloadRaw.phone !== undefined ? { phone: payloadRaw.phone } : {}),
      };
      const created = await createDriver(payload);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  // Cria ou atualiza motorista pelo código (matrícula).
  // Usado pelo GAS para sincronizar motoristas da planilha sem precisar de lookup prévio.
  app.post("/drivers/upsert", async (req, res, next) => {
    try {
      const payloadRaw = createDriverSchema.parse(req.body);
      const driver = await upsertDriver({
        code: payloadRaw.code,
        name: payloadRaw.name,
        base: payloadRaw.base ?? null,
        phone: payloadRaw.phone ?? null,
      });
      res.status(200).json(driver);
    } catch (err) {
      next(err);
    }
  });

  // Ficha completa do motorista (inclui telefone, usado pelo botão de WhatsApp).
  app.get("/drivers/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      const driver = await getDriver(id);
      if (!driver) return res.status(404).json({ message: "Driver not found" });
      return res.json({ data: driver });
    } catch (err) {
      next(err);
    }
  });

  // Recorrência do motorista no mês corrente (advertência / vale / suspensão).
  app.get("/drivers/:id/stats", async (req, res, next) => {
    try {
      const { id } = req.params;
      const stats = await getDriverStats(id);
      return res.json({ data: stats });
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
        phone?: string | null;
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
      if (parsed.phone !== undefined) {
        payload.phone = parsed.phone ?? null;
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
