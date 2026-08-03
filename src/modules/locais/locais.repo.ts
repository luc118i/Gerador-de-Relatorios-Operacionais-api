import { supabaseAdmin } from "../../core/infra/supabaseAdmin.js";

export async function findAllLocais(search?: string) {
  let query = supabaseAdmin.from("locais").select("id, nome, sigla").order("nome");

  if (search) {
    query = query.ilike("nome", `%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function insertLocal(args: {
  nome: string;
  sigla?: string | null | undefined;
  tipo?: string | null | undefined;
  lat?: number | null | undefined;
  lng?: number | null | undefined;
}) {
  const { data, error } = await supabaseAdmin
    .from("locais")
    .insert({
      nome: args.nome.trim(),
      sigla: args.sigla?.trim() || null,
      tipo: args.tipo?.trim() || null,
      lat: args.lat ?? null,
      lng: args.lng ?? null,
      ativo: true,
    })
    .select("id, nome, sigla")
    .single();

  if (error) throw new Error(error.message);
  return data as { id: number; nome: string; sigla: string | null };
}

export async function findLocalById(id: number): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("locais")
    .select("nome")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return (data as any).nome as string;
}
