import { supabaseAdmin } from "../../core/infra/supabaseAdmin.js";

export async function findAllLocais(search?: string) {
  let query = supabaseAdmin.from("locais").select("id, nome").order("nome");

  if (search) {
    query = query.ilike("nome", `%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}
