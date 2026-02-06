import { supabaseAdmin } from "../../../core/config/supabase";
import type { PdfDriver, PdfEvidence, PdfOccurrence } from "./pdf.types";
import { AppError } from "./pdf.errors";

export async function getOccurrenceForPdf(
  occurrenceId: string,
): Promise<PdfOccurrence> {
  const { data, error } = await supabaseAdmin
    .from("occurrences")
    .select(
      `
      id,
      type_id,
      event_date,
      trip_date,
      start_time,
      end_time,
      vehicle_number,
      base_code,
      line_label,
      place,
      occurrence_types:occurrence_types (
        title,
        code
      )
    `,
    )
    .eq("id", occurrenceId)
    .maybeSingle();

  if (error) {
    console.error("[getOccurrenceForPdf] supabase error:", {
      message: error.message,
      details: (error as any).details,
      hint: (error as any).hint,
      code: (error as any).code,
    });
    throw new AppError(
      500,
      "Falha ao buscar ocorrência",
      "OCCURRENCE_QUERY_FAILED",
    );
  }

  if (!data)
    throw new AppError(
      404,
      "Ocorrência não encontrada",
      "OCCURRENCE_NOT_FOUND",
    );

  return {
    id: data.id,
    typeId: data.type_id,
    typeTitle: (data as any).occurrence_types?.title ?? null,
    typeCode: (data as any).occurrence_types?.code ?? null,
    eventDate: String(data.event_date),
    tripDate: String(data.trip_date),
    startTime: String(data.start_time),
    endTime: String(data.end_time),
    vehicleNumber: data.vehicle_number,
    baseCode: data.base_code,
    lineLabel: data.line_label,
    place: data.place,
    reportText: "",
  };
}

export async function listDriversByOccurrence(
  occurrenceId: string,
): Promise<PdfDriver[]> {
  const { data, error } = await supabaseAdmin
    .from("occurrence_drivers")
    .select("id, name, registry, position , base_code")
    .eq("occurrence_id", occurrenceId)
    .order("position", { ascending: true });

  if (error) {
    console.warn("[listDriversByOccurrence] failed", {
      occurrenceId,
      message: error.message,
      code: (error as any).code,
      details: (error as any).details,
    });
    return [];
  }

  return (data ?? []).map((d: any) => ({
    id: d.id,
    name: d.name,
    code: d.registry,
    baseCode: d.base_code,
  }));
}

export async function listEvidencesByOccurrence(
  occurrenceId: string,
): Promise<PdfEvidence[]> {
  const { data, error } = await supabaseAdmin
    .from("occurrence_evidences")
    .select("id, sort_order, storage_path, caption, created_at")
    .eq("occurrence_id", occurrenceId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("[listEvidencesByOccurrence] skipped (not available yet)", {
      message: error.message,
      code: (error as any).code,
      details: (error as any).details,
    });
    return [];
  }

  return (data ?? []).map((e: any) => ({
    id: e.id,
    storagePath: e.storage_path,
    mimeType: null, // não existe na tabela -> inferimos pelo path no service
    caption: e.caption ?? null,
    sortOrder: e.sort_order ?? null,
  }));
}
