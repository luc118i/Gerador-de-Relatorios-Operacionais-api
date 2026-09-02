// src/modules/disciplinary/disciplinary.service.ts
import {
  getDriverSituationRow,
  getDriverMonthlyOccurrencesRows,
  getDashboardRows,
  getDriverOccurrenceHistoryRows,
  type DashboardRow,
} from "./disciplinary.repo.js";
import { listBaseResponsaveis } from "../base-responsaveis/base-responsaveis.repo.js";
import {
  buildRegistryLabelMap,
  canonicalBaseLabel,
} from "./base-canonical.js";

export async function getDriverSituation(driverId: string) {
  const row = await getDriverSituationRow(driverId);
  if (!row) return null;

  return {
    driverId: row.driver_id,
    totalOcorrencias: row.total_ocorrencias,
    recentes90d: row.recentes_90d,
    reincidencias: row.reincidencias,
    // Fórmula (view driver_disciplinary_index): 100 − (peso das medidas dos
    // últimos 90 dias × 10), piso 0. Pesos: Registro/Orientação 0,05 ·
    // Advertência 1,0 · Vale/Suspensão 2,0.
    indice: row.indice,
    situacao: row.situacao,
  };
}

export async function getDriverMonthlyOccurrences(
  driverId: string,
  months: number,
) {
  const since = new Date();
  since.setDate(1);
  since.setMonth(since.getMonth() - (months - 1));
  const sinceISO = since.toISOString().slice(0, 10);

  const rows = await getDriverMonthlyOccurrencesRows(driverId, sinceISO);

  return rows.map((r) => ({
    month: r.month, // YYYY-MM-DD (primeiro dia do mês)
    total: r.total,
    advertencias: r.advertencias,
    vales: r.vales,
    suspensoes: r.suspensoes,
  }));
}

const RANKING_LIMIT = 10;

export async function getDashboardSummary() {
  const rows = await getDashboardRows();

  // De-para de normalização de base (legado com grafias variadas). Se o
  // cadastro de bases falhar, segue sem ele — a normalização de caixa ainda
  // agrupa "Montes Claros" / "MONTES CLAROS".
  const registryByKey = buildRegistryLabelMap(
    await listBaseResponsaveis().catch(() => []),
  );
  const SEM_BASE = "Sem base";
  const baseLabelOf = (raw: string | null) =>
    canonicalBaseLabel(raw, registryByKey) ?? SEM_BASE;

  const totals = {
    motoristas: rows.length,
    comOcorrencia: rows.filter((r) => r.total_ocorrencias > 0).length,
    reincidentes: rows.filter((r) => r.reincidencias > 0).length,
    criticos: rows.filter((r) => r.situacao === "CRITICO").length,
  };

  const porBaseMap = new Map<string, number>();
  for (const r of rows) {
    const base = baseLabelOf(r.base);
    porBaseMap.set(base, (porBaseMap.get(base) ?? 0) + r.total_ocorrencias);
  }
  const porBase = Array.from(porBaseMap.entries())
    .map(([base, total]) => ({ base, total }))
    .filter((b) => b.total > 0)
    .sort((a, b) => b.total - a.total);

  // "Piores": menor índice primeiro; empate desempatado por mais ocorrências.
  const ranking = [...rows]
    .sort((a, b) => a.indice - b.indice || b.total_ocorrencias - a.total_ocorrencias)
    .slice(0, RANKING_LIMIT)
    .map((r) => toRankingEntry(r, registryByKey));

  return { totals, porBase, ranking };
}

const HISTORY_LIMIT = 20;

export async function getDriverOccurrenceHistory(driverId: string, limit = HISTORY_LIMIT) {
  const rows = await getDriverOccurrenceHistoryRows(driverId, limit);

  return rows.map((r) => ({
    id: r.id,
    eventDate: r.event_date,
    typeCode: r.type_code,
    typeTitle: r.type_title,
    occurrenceName: r.occurrence_name,
    place: r.place,
    vehicleNumber: r.vehicle_number,
    tratativa: r.tratativa,
    analisadoPor: r.analisado_por,
    driveWebViewLink: r.drive_web_view_link,
  }));
}

function toRankingEntry(r: DashboardRow, registryByKey: Map<string, string>) {
  return {
    driverId: r.driver_id,
    code: r.code,
    name: r.name,
    base: canonicalBaseLabel(r.base, registryByKey),
    totalOcorrencias: r.total_ocorrencias,
    reincidencias: r.reincidencias,
    indice: r.indice,
    situacao: r.situacao,
  };
}
