import { supabaseAdmin } from "../../../core/infra/supabaseAdmin.js";
import type { LocalForMatching } from "../types/telemetry.types.js";

export async function findLocaisForMatching(): Promise<LocalForMatching[]> {
  const { data, error } = await supabaseAdmin
    .from("locais")
    .select("id, nome, sigla, codigo, lat, lng, tipo, vel_max_kmh, raio_m, pedagio, rodoviaria, garagem, ativo")
    .eq("ativo", true);

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    id: r.id as number,
    codigo: (r.codigo as string | null) ?? null,
    descResumida: (r.sigla as string | null) ?? (r.nome as string),
    descricao: r.nome as string,
    lat: (r.lat as number | null) ?? null,
    lng: (r.lng as number | null) ?? null,
    tipo: (r.tipo as string | null) ?? null,
    vel: (r.vel_max_kmh as number | null) ?? null,
    raio: (r.raio_m as number | null) ?? null,
    pedagio: (r.pedagio as boolean | null) ?? false,
    rodoviaria: (r.rodoviaria as boolean | null) ?? false,
    garagem: (r.garagem as boolean | null) ?? false,
  }));
}
