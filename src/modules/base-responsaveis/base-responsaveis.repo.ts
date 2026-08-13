import { supabaseAdmin } from "../../core/infra/supabaseAdmin.js";

export type BaseResponsavel = {
  sigla: string;
  responsavel: string;
  visibilidade: string;
  // WhatsApp do responsável — usado no envio do relatório diário por base.
  // Null/ausente pra bases cadastradas antes desse campo existir.
  telefone: string | null;
};

export async function listBaseResponsaveis(): Promise<BaseResponsavel[]> {
  const { data, error } = await supabaseAdmin
    .from("base_responsaveis")
    .select("sigla, responsavel, visibilidade, telefone")
    .order("sigla", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createBaseResponsavel(
  input: Omit<BaseResponsavel, "telefone"> & { telefone?: string | null | undefined },
): Promise<BaseResponsavel> {
  const { data, error } = await supabaseAdmin
    .from("base_responsaveis")
    .insert({
      sigla: input.sigla.trim().toUpperCase(),
      responsavel: input.responsavel.trim(),
      visibilidade: input.visibilidade.trim(),
      telefone: input.telefone?.trim() || null,
    })
    .select("sigla, responsavel, visibilidade, telefone")
    .single();

  if (error) throw error;
  return data;
}

export async function updateBaseResponsavel(
  sigla: string,
  input: { responsavel?: string | undefined; visibilidade?: string | undefined; telefone?: string | null | undefined },
): Promise<BaseResponsavel | null> {
  const payload: Record<string, string | null> = {};
  if (input.responsavel !== undefined) payload.responsavel = input.responsavel.trim();
  if (input.visibilidade !== undefined) payload.visibilidade = input.visibilidade.trim();
  if (input.telefone !== undefined) payload.telefone = input.telefone?.trim() || null;

  const { data, error } = await supabaseAdmin
    .from("base_responsaveis")
    .update(payload)
    .eq("sigla", sigla.trim().toUpperCase())
    .select("sigla, responsavel, visibilidade, telefone")
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
