// src/modules/drivers/drivers.repo.ts
import { supabaseAdmin } from "../../core/infra/supabaseAdmin.js";
import { canonBase } from "../../shared/normalizer/index.js";

export async function searchDrivers(args: {
  search?: string;
  active?: boolean;
  limit?: number;
}) {
  const search = (args.search ?? "").trim();
  const active = args.active ?? true;
  const limit = args.limit ?? 20;

  let q = supabaseAdmin
    .from("drivers")
    .select("id, code, name, base, phone, active, created_at")
    .eq("active", active)
    .order("name", { ascending: true })
    .limit(limit);

  if (search) {
    // busca simples (OR em code/name) — suficiente e compatível
    q = q.or(`code.ilike.%${search}%,name.ilike.%${search}%`);
  }

  const { data, error } = await q;
  if (error) throw error;

  return data ?? [];
}

export async function lookupDriverByCode(code: string) {
  const { data, error } = await supabaseAdmin
    .from("drivers")
    .select("id, code, name, base, phone")
    .eq("code", code.trim())
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  return data as { id: string; code: string; name: string; base: string | null; phone: string | null } | null;
}

export async function getDriverById(id: string) {
  const { data, error } = await supabaseAdmin
    .from("drivers")
    .select("id, code, name, base, phone, criado_por, criado_por_user_id, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as
    | {
        id: string;
        code: string;
        name: string;
        base: string | null;
        phone: string | null;
        criado_por: string | null;
        criado_por_user_id: string | null;
        created_at: string | null;
      }
    | null;
}

export async function insertDriver(args: {
  code: string;
  name: string;
  base: string | null;
  phone?: string | null;
  criadoPor?: string | null;
  criadoPorId?: string | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("drivers")
    .insert({
      code: args.code.trim(),
      name: args.name.trim(),
      base: canonBase(args.base),
      phone: args.phone?.trim() || null,
      criado_por: args.criadoPor?.trim() || null,
      criado_por_user_id: args.criadoPorId || null,
      active: true,
    })
    .select(
      "id, code, name, base, phone, active, criado_por, criado_por_user_id, created_at",
    )
    .single();

  if (error) throw error;
  return data as {
    id: string;
    code: string;
    name: string;
    base: string | null;
    phone: string | null;
    active: boolean;
    criado_por: string | null;
    criado_por_user_id: string | null;
    created_at: string | null;
  };
}

export async function updateDriverRepo(args: {
  id: string;
  code?: string;
  name?: string;
  base?: string | null;
  phone?: string | null;
}) {
  const payload: Record<string, any> = {};

  if (args.code !== undefined) payload.code = args.code.trim();
  if (args.name !== undefined) payload.name = args.name.trim();
  if (args.base !== undefined) payload.base = canonBase(args.base);
  if (args.phone !== undefined) payload.phone = args.phone?.trim() || null;

  const { data, error } = await supabaseAdmin
    .from("drivers")
    .update(payload)
    .eq("id", args.id)
    .select("id")
    .single();

  if (error) throw error;

  return !!data;
}

export async function upsertDriverRepo(args: {
  code: string;
  name: string;
  base: string | null;
  phone?: string | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("drivers")
    .upsert(
      {
        code: args.code.trim(),
        name: args.name.trim(),
        base: canonBase(args.base),
        ...(args.phone !== undefined ? { phone: args.phone?.trim() || null } : {}),
        active: true,
      },
      { onConflict: "code" },
    )
    .select("id, code, name, base, phone")
    .single();

  if (error) throw error;
  return data as { id: string; code: string; name: string; base: string | null; phone: string | null };
}

export async function deleteDriverRepo(id: string) {
  const { data, error } = await supabaseAdmin
    .from("drivers")
    .update({ active: false })
    .eq("id", id)
    .select("id")
    .single();

  if (error) throw error;

  return !!data;
}

export type MatchDriverRow = {
  id: string;
  code: string;
  name: string;
  base: string | null;
  phone: string | null;
  active: boolean;
};

// Busca motoristas por uma lista de matrículas (chunked p/ não estourar o
// tamanho do filtro `in`). Sem filtro de nome aqui — nome é resolvido em
// memória pelo service via getAllDriversForMatch.
export async function findDriversByCodes(
  codes: string[],
  includeInactive: boolean,
): Promise<MatchDriverRow[]> {
  if (codes.length === 0) return [];

  const out: MatchDriverRow[] = [];
  const CHUNK = 200;

  for (let i = 0; i < codes.length; i += CHUNK) {
    const slice = codes.slice(i, i + CHUNK);
    let q = supabaseAdmin
      .from("drivers")
      .select("id, code, name, base, phone, active")
      .in("code", slice);

    if (!includeInactive) q = q.eq("active", true);

    const { data, error } = await q;
    if (error) throw error;
    out.push(...((data ?? []) as MatchDriverRow[]));
  }

  return out;
}

// Tabela inteira de motoristas (paginada) pra montar índice de nome
// normalizado em memória. Só chamada quando sobra `name` sem match por
// matrícula. Volume atual (centenas/poucos milhares) comporta.
export async function getAllDriversForMatch(
  includeInactive: boolean,
): Promise<MatchDriverRow[]> {
  const out: MatchDriverRow[] = [];
  const PAGE = 1000;

  for (let from = 0; ; from += PAGE) {
    let q = supabaseAdmin
      .from("drivers")
      .select("id, code, name, base, phone, active")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);

    if (!includeInactive) q = q.eq("active", true);

    const { data, error } = await q;
    if (error) throw error;

    const rows = (data ?? []) as MatchDriverRow[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }

  return out;
}

// Conta as tratativas do motorista a partir de monthStartISO (mês corrente).
export async function getDriverTratativaCounts(driverId: string, monthStartISO: string) {
  const { data, error } = await supabaseAdmin
    .from("occurrence_drivers")
    .select("occurrences!inner(tratativa, created_at)")
    .eq("driver_id", driverId)
    .gte("occurrences.created_at", monthStartISO);

  if (error) throw error;

  let advertencia = 0;
  let vale = 0;
  let suspensao = 0;
  let total = 0;

  for (const row of (data ?? []) as any[]) {
    const occ = Array.isArray(row.occurrences) ? row.occurrences[0] : row.occurrences;
    if (!occ) continue;
    total++;
    switch (occ.tratativa) {
      case "ADVERTENCIA":
        advertencia++;
        break;
      case "VALE":
        vale++;
        break;
      case "SUSPEICAO":
        suspensao++;
        break;
    }
  }

  return { advertencia, vale, suspensao, total };
}
