// src/modules/trips/trips.routes.ts
import type { Express } from "express";
import { listTripsSchema, lookupTripSchema, createTripSchema } from "./trips.schemas.js";
import { listTrips, lookupTrip, createTrip } from "./trips.service.js";
import { fetchTripById } from "./trips.repo.js";

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

  app.get("/trips/:id/schema", async (req, res, next) => {
    try {
      const { id } = req.params;
      const trip = await fetchTripById(id);
      if (!trip) return res.status(404).json({ found: false, message: "Trip not found" });

      const gasUrl = (process.env.GAS_ANALISE_URL ?? "").replace(/\/$/, "");
      if (!gasUrl) return res.status(503).json({ found: false, message: "GAS_ANALISE_URL not configured" });

      const url = `${gasUrl}?action=getSchema&lineName=${encodeURIComponent(trip.line_name)}&departureTime=${encodeURIComponent(trip.departure_time)}`;
      const gasRes = await fetch(url);
      if (!gasRes.ok) return res.json({ found: false });

      const data = await gasRes.json() as { found: boolean; html?: string };
      return res.json(data);
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
