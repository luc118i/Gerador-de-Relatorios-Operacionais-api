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

// ── Normalização de sentido (IDA / VOLTA) ─────────────────────────────────────
function normalizeDirection(s: string): string {
  const u = (s ?? "").toUpperCase();
  if (u.includes("VOLTA")) return "VOLTA";
  if (u.includes("IDA")) return "IDA";
  return u.replace(/\s+/g, " ").trim();
}
function directionsMatch(a: string, b: string): boolean {
  const na = normalizeDirection(a);
  const nb = normalizeDirection(b);
  return !!na && !!nb && na === nb;
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

/**
 * Resolve a viagem na base a partir de horário + código da linha (+ sentido),
 * com fallback por nome. Prioriza o código (autoritativo); usa o nome só como
 * refinamento/desempate ou quando não há código. Sentido desempata quando há
 * múltiplas linhas com o mesmo código no mesmo horário (ida/volta).
 */
export async function lookupTrip(params: {
  lineCode?: string | undefined;
  lineName?: string | undefined;
  departureTime: string;
  direction?: string | undefined;
}) {
  const rows = (await fetchTripsByDepartureTime(params.departureTime)) as any[];
  if (rows.length === 0) return null;

  const code = (params.lineCode ?? "").trim();
  const name = (params.lineName ?? "").trim();
  const dir = (params.direction ?? "").trim();

  let candidates: any[];
  if (code) {
    candidates = rows.filter((r) => String(r.line_code).trim() === code);
    // Código não encontrado → cai para o match por nome (não perde a viagem)
    if (candidates.length === 0 && name) {
      candidates = rows.filter((r) => lineNamesMatch(r.line_name, name));
    }
  } else if (name) {
    candidates = rows.filter((r) => lineNamesMatch(r.line_name, name));
  } else {
    candidates = rows;
  }

  // Desempata por sentido, quando informado
  if (candidates.length > 1 && dir) {
    const byDir = candidates.filter((r) => directionsMatch(r.direction, dir));
    if (byDir.length) candidates = byDir;
  }
  // Desempata por nome (ex.: mesmo código com nomes distintos)
  if (candidates.length > 1 && name) {
    const byName = candidates.filter((r) => lineNamesMatch(r.line_name, name));
    if (byName.length) candidates = byName;
  }

  const match = candidates[0];
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
