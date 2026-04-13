// src/modules/trips/trips.routes.ts
import type { Express } from "express";
import { listTripsSchema, createTripSchema } from "./trips.schemas.js";
import { listTrips, createTrip } from "./trips.service.js";

export function tripsRoutes(app: Express) {
  app.get("/trips", async (req, res, next) => {
    try {
      const parsed = listTripsSchema.parse(req.query);
      const data = await listTrips({ search: parsed.search });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  app.post("/trips", async (req, res, next) => {
    try {
      const payload = createTripSchema.parse(req.body);
      const created = await createTrip(payload);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });
}
