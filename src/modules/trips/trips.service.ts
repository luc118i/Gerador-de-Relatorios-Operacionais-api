// src/modules/trips/trips.service.ts
import { searchTrips, insertTrip, fetchTripsByDepartureTime } from "./trips.repo.js";

// ── Normalização de nome de linha ─────────────────────────────────────────────

function normalizeCity(s: string): string {
  return s
    .toUpperCase()
    .replace(/\(\s*([A-Z]{2})\s*\)/g, " ($1)") // RECIFE(PE) ou ( PE ) → (PE)
    .replace(/\s+/g, " ")
    .trim();
}

function splitLineParts(name: string): string[] {
  // Separa por "-" (com espaços opcionais) ou por "x"/"×" (com espaços obrigatórios)
  return name
    .split(/\s*-\s*|\s+[xX×]\s+/)
    .map(normalizeCity)
    .filter(Boolean);
}

function lineNamesMatch(a: string, b: string): boolean {
  const partsA = new Set(splitLineParts(a));
  const partsB = new Set(splitLineParts(b));
  if (partsA.size !== partsB.size) return false;
  for (const p of partsA) if (!partsB.has(p)) return false;
  return true;
}

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

export async function lookupTrip(lineName: string, departureTime: string) {
  const rows = await fetchTripsByDepartureTime(departureTime);
  const match = rows.find((r: any) => lineNamesMatch(r.line_name, lineName));
  if (!match) return null;
  return {
    id: match.id as string,
    lineCode: match.line_code as string,
    lineName: match.line_name as string,
    departureTime: match.departure_time as string,
    direction: match.direction as string,
  };
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
