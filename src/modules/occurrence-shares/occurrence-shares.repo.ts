import { supabaseAdmin } from "../../core/infra/supabaseAdmin.js";

const TABLE = "occurrence_shares";

export type ShareRow = {
  token: string;
  occurrence_id: string;
  active: boolean;
  sections: Record<string, boolean>;
  created_at: string;
  created_by: string | null;
  revoked_at: string | null;
};

/** Share mais recente da ocorrência (ativo ou não). */
export async function getShareByOccurrence(
  occurrenceId: string,
): Promise<ShareRow | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("*")
    .eq("occurrence_id", occurrenceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ShareRow | null) ?? null;
}

export async function getActiveShareByToken(
  token: string,
): Promise<ShareRow | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("*")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as ShareRow | null) ?? null;
}

export async function deactivateSharesByOccurrence(
  occurrenceId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from(TABLE)
    .update({ active: false, revoked_at: new Date().toISOString() })
    .eq("occurrence_id", occurrenceId)
    .eq("active", true);
  if (error) throw error;
}

export async function insertShare(row: {
  token: string;
  occurrenceId: string;
  createdBy: string | null;
  sections: Record<string, boolean>;
}): Promise<ShareRow> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .insert({
      token: row.token,
      occurrence_id: row.occurrenceId,
      created_by: row.createdBy,
      sections: row.sections,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ShareRow;
}

export async function updateShare(
  token: string,
  patch: { active?: boolean; sections?: Record<string, boolean> },
): Promise<ShareRow | null> {
  const data: Record<string, unknown> = {};
  if (patch.active !== undefined) {
    data.active = patch.active;
    data.revoked_at = patch.active ? null : new Date().toISOString();
  }
  if (patch.sections !== undefined) data.sections = patch.sections;

  const { data: row, error } = await supabaseAdmin
    .from(TABLE)
    .update(data)
    .eq("token", token)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (row as ShareRow | null) ?? null;
}
