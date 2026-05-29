import {
  findAllSchemes,
  findSchemeById,
  insertScheme,
  updateSchemeRepo,
  softDeleteScheme,
  findPointsByScheme,
  replaceSchemePoints,
  findSpeedConfigByScheme,
  upsertSpeedConfigs,
} from "./route-schemes.repo.js";
import type { CreateSchemeInput, UpdateSchemeInput, ReplacePointsInput, UpsertSpeedConfigInput } from "./route-schemes.schemas.js";

export async function listSchemes(args: { search?: string; active?: boolean }) {
  const rows = await findAllSchemes(args);
  return rows.map((r: any) => ({
    id: r.id as string,
    tripId: r.trip_id as string | null,
    nomeLinha: r.nome_linha as string,
    horario: r.horario as string | null,
    sentido: r.sentido as string | null,
    active: r.active as boolean,
    createdAt: r.created_at as string,
  }));
}

export async function getScheme(id: string) {
  const row = await findSchemeById(id);
  if (!row) return null;

  const points = await findPointsByScheme(id);
  const speedConfig = await findSpeedConfigByScheme(id);

  return {
    id: row.id as string,
    tripId: row.trip_id as string | null,
    nomeLinha: row.nome_linha as string,
    horario: row.horario as string | null,
    sentido: row.sentido as string | null,
    active: row.active as boolean,
    createdAt: row.created_at as string,
    points: points.map((p: any) => ({
      id: p.id as string,
      ordem: p.ordem as number,
      localId: p.local_id as number | null,
      nomePonto: p.nome_ponto as string,
      tipo: p.tipo as string | null,
      horarioComercial: p.horario_comercial as string | null,
      tempoLocalMin: p.tempo_local_min as number | null,
      tipoTrecho: p.tipo_trecho as string | null,
    })),
    speedConfig: speedConfig.map((s: any) => ({
      id: s.id as string,
      tipoVia: s.tipo_via as string,
      velKmh: s.vel_kmh as number,
    })),
  };
}

export async function createScheme(payload: CreateSchemeInput) {
  const row = await insertScheme({
    tripId: payload.tripId ?? null,
    nomeLinha: payload.nomeLinha,
    horario: payload.horario ?? null,
    sentido: payload.sentido ?? null,
  });

  return {
    id: (row as any).id as string,
    tripId: (row as any).trip_id as string | null,
    nomeLinha: (row as any).nome_linha as string,
    horario: (row as any).horario as string | null,
    sentido: (row as any).sentido as string | null,
    active: (row as any).active as boolean,
    createdAt: (row as any).created_at as string,
  };
}

export async function updateScheme(id: string, payload: UpdateSchemeInput) {
  const args: Parameters<typeof updateSchemeRepo>[0] = { id };
  if (payload.nomeLinha !== undefined) args.nomeLinha = payload.nomeLinha;
  if (payload.horario !== undefined) args.horario = payload.horario ?? null;
  if (payload.sentido !== undefined) args.sentido = payload.sentido ?? null;
  if (payload.tripId !== undefined) args.tripId = payload.tripId ?? null;
  return updateSchemeRepo(args);
}

export async function deleteScheme(id: string) {
  return softDeleteScheme(id);
}

export async function getSchemePoints(schemeId: string) {
  const rows = await findPointsByScheme(schemeId);
  return rows.map((p: any) => ({
    id: p.id as string,
    ordem: p.ordem as number,
    localId: p.local_id as number | null,
    nomePonto: p.nome_ponto as string,
    tipo: p.tipo as string | null,
    horarioComercial: p.horario_comercial as string | null,
    tempoLocalMin: p.tempo_local_min as number | null,
    tipoTrecho: p.tipo_trecho as string | null,
  }));
}

export async function setSchemePoints(schemeId: string, payload: ReplacePointsInput) {
  const rows = await replaceSchemePoints(
    schemeId,
    payload.points.map((p) => ({
      ordem: p.ordem,
      localId: p.localId ?? null,
      nomePonto: p.nomePonto,
      tipo: p.tipo ?? null,
      horarioComercial: p.horarioComercial ?? null,
      tempoLocalMin: p.tempoLocalMin ?? null,
      tipoTrecho: p.tipoTrecho ?? null,
    })),
  );

  return rows.map((p: any) => ({
    id: p.id as string,
    ordem: p.ordem as number,
    localId: p.local_id as number | null,
    nomePonto: p.nome_ponto as string,
    tipo: p.tipo as string | null,
    horarioComercial: p.horario_comercial as string | null,
    tempoLocalMin: p.tempo_local_min as number | null,
    tipoTrecho: p.tipo_trecho as string | null,
  }));
}

export async function getSpeedConfig(schemeId: string) {
  const rows = await findSpeedConfigByScheme(schemeId);
  return rows.map((s: any) => ({
    id: s.id as string,
    tipoVia: s.tipo_via as string,
    velKmh: s.vel_kmh as number,
  }));
}

export async function setSpeedConfig(schemeId: string, payload: UpsertSpeedConfigInput) {
  const rows = await upsertSpeedConfigs(schemeId, payload.configs);
  return rows.map((s: any) => ({
    id: s.id as string,
    tipoVia: s.tipo_via as string,
    velKmh: s.vel_kmh as number,
  }));
}
