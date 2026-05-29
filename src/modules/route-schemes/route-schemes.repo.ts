import { supabaseAdmin } from "../../core/infra/supabaseAdmin.js";

// ─── Schemes ────────────────────────────────────────────────────────────────

export async function findAllSchemes(args: { search?: string; active?: boolean }) {
  const active = args.active ?? true;

  let q = supabaseAdmin
    .from("route_schemes")
    .select("id, trip_id, nome_linha, horario, sentido, active, created_at")
    .eq("active", active)
    .order("nome_linha", { ascending: true });

  if (args.search?.trim()) {
    q = q.ilike("nome_linha", `%${args.search.trim()}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function findSchemeById(id: string) {
  const { data, error } = await supabaseAdmin
    .from("route_schemes")
    .select("id, trip_id, nome_linha, horario, sentido, active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function insertScheme(args: {
  tripId: string | null;
  nomeLinha: string;
  horario: string | null;
  sentido: string | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("route_schemes")
    .insert({
      trip_id: args.tripId,
      nome_linha: args.nomeLinha.trim(),
      horario: args.horario ?? null,
      sentido: args.sentido?.trim() ?? null,
      active: true,
    })
    .select("id, trip_id, nome_linha, horario, sentido, active, created_at")
    .single();

  if (error) throw error;
  return data;
}

export async function updateSchemeRepo(args: {
  id: string;
  nomeLinha?: string;
  horario?: string | null;
  sentido?: string | null;
  tripId?: string | null;
}) {
  const payload: Record<string, unknown> = {};
  if (args.nomeLinha !== undefined) payload.nome_linha = args.nomeLinha.trim();
  if (args.horario !== undefined) payload.horario = args.horario;
  if (args.sentido !== undefined) payload.sentido = args.sentido?.trim() ?? null;
  if (args.tripId !== undefined) payload.trip_id = args.tripId;

  const { data, error } = await supabaseAdmin
    .from("route_schemes")
    .update(payload)
    .eq("id", args.id)
    .select("id")
    .single();

  if (error) throw error;
  return !!data;
}

export async function softDeleteScheme(id: string) {
  const { data, error } = await supabaseAdmin
    .from("route_schemes")
    .update({ active: false })
    .eq("id", id)
    .select("id")
    .single();

  if (error) throw error;
  return !!data;
}

// ─── Scheme Points ───────────────────────────────────────────────────────────

export async function findPointsByScheme(schemeId: string) {
  const { data, error } = await supabaseAdmin
    .from("route_scheme_points")
    .select("id, scheme_id, ordem, local_id, nome_ponto, tipo, horario_comercial, tempo_local_min, tipo_trecho")
    .eq("scheme_id", schemeId)
    .order("ordem", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function replaceSchemePoints(
  schemeId: string,
  points: Array<{
    ordem: number;
    localId: number | null;
    nomePonto: string;
    tipo: string | null;
    horarioComercial: string | null;
    tempoLocalMin: number | null;
    tipoTrecho: string | null;
  }>,
) {
  // Remove todos os pontos existentes e reinsere na sequência nova
  const { error: deleteError } = await supabaseAdmin
    .from("route_scheme_points")
    .delete()
    .eq("scheme_id", schemeId);

  if (deleteError) throw deleteError;

  if (points.length === 0) return [];

  const rows = points.map((p) => ({
    scheme_id: schemeId,
    ordem: p.ordem,
    local_id: p.localId ?? null,
    nome_ponto: p.nomePonto.trim(),
    tipo: p.tipo ?? null,
    horario_comercial: p.horarioComercial ?? null,
    tempo_local_min: p.tempoLocalMin ?? null,
    tipo_trecho: p.tipoTrecho ?? null,
  }));

  const { data, error } = await supabaseAdmin
    .from("route_scheme_points")
    .insert(rows)
    .select("id, scheme_id, ordem, local_id, nome_ponto, tipo, horario_comercial, tempo_local_min, tipo_trecho");

  if (error) throw error;
  return data ?? [];
}

// ─── Speed Config ────────────────────────────────────────────────────────────

export async function findSpeedConfigByScheme(schemeId: string) {
  const { data, error } = await supabaseAdmin
    .from("route_speed_config")
    .select("id, scheme_id, tipo_via, vel_kmh")
    .eq("scheme_id", schemeId)
    .order("tipo_via", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function upsertSpeedConfigs(
  schemeId: string,
  configs: Array<{ tipoVia: string; velKmh: number }>,
) {
  const rows = configs.map((c) => ({
    scheme_id: schemeId,
    tipo_via: c.tipoVia,
    vel_kmh: c.velKmh,
  }));

  const { data, error } = await supabaseAdmin
    .from("route_speed_config")
    .upsert(rows, { onConflict: "scheme_id,tipo_via" })
    .select("id, scheme_id, tipo_via, vel_kmh");

  if (error) throw error;
  return data ?? [];
}
