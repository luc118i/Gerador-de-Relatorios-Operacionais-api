import { supabaseAdmin } from "../../core/infra/supabaseAdmin.js";

export type Preset = { id: string; name: string };

export async function listPresets(): Promise<Preset[]> {
  const { data, error } = await supabaseAdmin
    .from("occurrence_name_presets")
    .select("id, name")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createPreset(name: string): Promise<Preset> {
  const { data, error } = await supabaseAdmin
    .from("occurrence_name_presets")
    .insert({ name: name.trim().toUpperCase() })
    .select("id, name")
    .single();

  if (error) throw error;
  return data;
}

export async function deletePreset(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("occurrence_name_presets")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
