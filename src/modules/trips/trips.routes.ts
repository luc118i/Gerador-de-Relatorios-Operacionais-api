// src/modules/trips/trips.routes.ts
import type { Express } from "express";
import { listTripsSchema, lookupTripSchema, createTripSchema } from "./trips.schemas.js";
import { listTrips, lookupTrip, createTrip } from "./trips.service.js";

export function tripsRoutes(app: Express) {
  app.get("/trips", async (req, res, next) => {
    try {
      const parsed = listTripsSchema.parse(req.query);
      const params =
        parsed.search !== undefined ? { search: parsed.search } : {};
      const data = await listTrips(params);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  });

  app.get("/trips/lookup", async (req, res, next) => {
    try {
      const { lineName, departureTime } = lookupTripSchema.parse(req.query);
      const trip = await lookupTrip(lineName, departureTime);
      if (!trip) return res.status(404).json({ message: "Viagem não encontrada" });
      return res.json(trip);
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
