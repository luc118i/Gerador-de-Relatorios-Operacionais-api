// src/modules/drivers/drivers.repo.ts
import { supabaseAdmin } from "../../core/infra/supabaseAdmin.js";

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
    .select("id, code, name, base, active, created_at")
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

export async function insertDriver(args: {
  code: string;
  name: string;
  base: string | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("drivers")
    .insert({
      code: args.code.trim(),
      name: args.name.trim(),
      base: args.base?.trim() || null,
      active: true,
    })
    .select("id, code, name, base, active")
    .single();

  if (error) throw error;
  return data as { id: string; code: string; name: string; base: string | null; active: boolean };
}

export async function updateDriverRepo(args: {
  id: string;
  code?: string;
  name?: string;
  base?: string | null;
}) {
  const payload: Record<string, any> = {};

  if (args.code !== undefined) payload.code = args.code.trim();
  if (args.name !== undefined) payload.name = args.name.trim();
  if (args.base !== undefined) payload.base = args.base?.trim() || null;

  const { data, error } = await supabaseAdmin
    .from("drivers")
    .update(payload)
    .eq("id", args.id)
    .select("id")
    .single();

  if (error) throw error;

  return !!data;
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
