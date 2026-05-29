import { normalizeText } from "../../../shared/normalizer/index.js";
import { STOP_THRESHOLDS } from "../constants/stop-thresholds.js";
import type { RawTripPoint, TelemetryPoint, LocalForMatching } from "../types/telemetry.types.js";

export function enrich(rawPoints: RawTripPoint[], locais: LocalForMatching[]): TelemetryPoint[] {
  const locaisMap = buildLocaisMap(locais);

  const enriched: TelemetryPoint[] = rawPoints.map((raw, i) => {
    const match = matchLocal(raw.ponto, locaisMap);
    return {
      seq:        i + 1,
      ponto:      raw.ponto,
      entrada:    raw.entrada || null,
      saida:      raw.saida || null,
      parada_s:   raw.parada_s,
      intervalo_s: raw.intervalo_s,
      veiculo:    raw.veiculo || null,
      funcionario: raw.funcionario || null,
      lat:        match?.lat ?? null,
      lng:        match?.lng ?? null,
      localId:    match?.id ?? null,
      tipo:       match?.tipo ?? "Desconhecido",
      velMaxKmh:  match?.vel ?? null,
      raioM:      match?.raio ?? null,
      pedagio:    match?.pedagio ?? false,
      rodoviaria: match?.rodoviaria ?? false,
      garagem:    match?.garagem ?? false,
      codigo:     match?.codigo ?? null,
      matched:    match !== null,
    };
  });

  return compactTrip(enriched);
}

// ─── Private ─────────────────────────────────────────────────────────────────

function buildLocaisMap(locais: LocalForMatching[]): Map<string, LocalForMatching> {
  const map = new Map<string, LocalForMatching>();
  for (const l of locais) {
    const k1 = normalizeText(l.descResumida);
    const k2 = normalizeText(l.descricao);
    const k3 = l.codigo ? normalizeText(l.codigo) : null;
    if (k1) map.set(k1, l);
    if (k2 && !map.has(k2)) map.set(k2, l);
    if (k3 && !map.has(k3)) map.set(k3, l);
  }
  return map;
}

function matchLocal(pontoBruto: string, map: Map<string, LocalForMatching>): LocalForMatching | null {
  if (!pontoBruto) return null;
  const key = normalizeText(pontoBruto);

  if (map.has(key)) return map.get(key)!;

  // Match parcial: chave está contida no ponto ou vice-versa (min 4 chars para evitar ruído)
  for (const [k, local] of map) {
    if (k.length > 4 && (key.includes(k) || k.includes(key))) {
      return local;
    }
  }

  return null;
}

function isSamePoint(a: TelemetryPoint, b: TelemetryPoint): boolean {
  const keyA = normalizeText(a.ponto);
  const keyB = normalizeText(b.ponto);
  if (keyA && keyB && keyA === keyB) return true;

  if (a.matched && b.matched) {
    if (a.codigo && b.codigo && a.codigo === b.codigo) return true;
    if (
      a.lat != null && a.lng != null &&
      b.lat != null && b.lng != null &&
      a.lat === b.lat && a.lng === b.lng
    ) return true;
  }

  return false;
}

function compactTrip(points: TelemetryPoint[]): TelemetryPoint[] {
  // Remove paradas muito curtas (manobras / cercas)
  const filtered = points.filter((pt) => {
    if (!pt.parada_s || pt.parada_s <= 0) return true;
    return pt.parada_s >= STOP_THRESHOLDS.MIN_PARADA_S;
  });

  if (filtered.length <= 1) return filtered;

  // Consolida pontos consecutivos no mesmo local
  const compacted: TelemetryPoint[] = [];
  for (const pt of filtered) {
    const prev = compacted[compacted.length - 1];
    if (!prev) {
      compacted.push({ ...pt });
      continue;
    }

    if (isSamePoint(prev, pt)) {
      prev.parada_s   = (prev.parada_s ?? 0) + (pt.parada_s ?? 0);
      prev.intervalo_s = Math.max(prev.intervalo_s ?? 0, pt.intervalo_s ?? 0);

      if (!prev.entrada || (pt.entrada && pt.entrada < prev.entrada)) prev.entrada = pt.entrada;
      if (!prev.saida   || (pt.saida   && pt.saida   > prev.saida))   prev.saida   = pt.saida;

      if (!prev.funcionario || prev.funcionario === "Não Informado") prev.funcionario = pt.funcionario;
      if (!prev.veiculo     || prev.veiculo === "—")                  prev.veiculo     = pt.veiculo;
    } else {
      compacted.push({ ...pt });
    }
  }

  // Reatribui seq após compactação
  compacted.forEach((p, i) => { p.seq = i + 1; });

  return compacted;
}
