import { supabaseAdmin } from "../../../core/infra/supabaseAdmin.js";

export type SuspensaoRecord = {
  dataInicio: string;
  dias: number;
  pdfPath: string;
};

export async function upsertSuspensao(
  occurrenceId: string,
  dataInicio: string,
  dias: number,
  pdfPath: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("suspensoes")
    .upsert(
      { occurrence_id: occurrenceId, data_inicio: dataInicio, dias, pdf_path: pdfPath },
      { onConflict: "occurrence_id" },
    );
  if (error) throw new Error(`upsertSuspensao: ${error.message}`);
}

export async function getSuspensaoByOccurrenceId(
  occurrenceId: string,
): Promise<SuspensaoRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("suspensoes")
    .select("data_inicio, dias, pdf_path")
    .eq("occurrence_id", occurrenceId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    dataInicio: (data as any).data_inicio as string,
    dias: (data as any).dias as number,
    pdfPath: (data as any).pdf_path as string,
  };
}
