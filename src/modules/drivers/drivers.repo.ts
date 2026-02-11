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

// drivers.repo.ts
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
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}
