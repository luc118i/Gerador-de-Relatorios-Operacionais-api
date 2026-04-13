// src/modules/trips/trips.service.ts
import { searchTrips, insertTrip } from "./trips.repo.js";

export async function listTrips(args: { search?: string; limit?: number }) {
  const rows = await searchTrips({ ...args, active: true });
  return rows.map((r: any) => ({
    id: r.id as string,
    lineCode: r.line_code as string,
    lineName: r.line_name as string,
    departureTime: r.departure_time as string,
    direction: r.direction as string,
  }));
}

export async function createTrip(args: {
  lineCode: string;
  lineName: string;
  departureTime: string;
  direction: string;
}) {
  const row = await insertTrip(args);
  return {
    id: row.id,
    lineCode: row.line_code,
    lineName: row.line_name,
    departureTime: row.departure_time,
    direction: row.direction,
  };
}
