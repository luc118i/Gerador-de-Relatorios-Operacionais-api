import { supabaseAdmin } from "../../core/infra/supabaseAdmin.js";

export type BaseResponsavel = { sigla: string; responsavel: string; visibilidade: string };

export async function listBaseResponsaveis(): Promise<BaseResponsavel[]> {
  const { data, error } = await supabaseAdmin
    .from("base_responsaveis")
    .select("sigla, responsavel, visibilidade")
    .order("sigla", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createBaseResponsavel(input: BaseResponsavel): Promise<BaseResponsavel> {
  const { data, error } = await supabaseAdmin
    .from("base_responsaveis")
    .insert({
      sigla: input.sigla.trim().toUpperCase(),
      responsavel: input.responsavel.trim(),
      visibilidade: input.visibilidade.trim(),
    })
    .select("sigla, responsavel, visibilidade")
    .single();

  if (error) throw error;
  return data;
}

export async function updateBaseResponsavel(
  sigla: string,
  input: { responsavel?: string | undefined; visibilidade?: string | undefined },
): Promise<BaseResponsavel | null> {
  const payload: Record<string, string> = {};
  if (input.responsavel !== undefined) payload.responsavel = input.responsavel.trim();
  if (input.visibilidade !== undefined) payload.visibilidade = input.visibilidade.trim();

  const { data, error } = await supabaseAdmin
    .from("base_responsaveis")
    .update(payload)
    .eq("sigla", sigla.trim().toUpperCase())
    .select("sigla, responsavel, visibilidade")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function deleteBaseResponsavel(sigla: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("base_responsaveis")
    .delete()
    .eq("sigla", sigla.trim().toUpperCase());

  if (error) throw error;
}
