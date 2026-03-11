import { supabaseAdmin } from "../../../core/config/supabase.js";
import type { PdfDriver, PdfEvidence, PdfOccurrence } from "./pdf.types.js";
import { AppError } from "./pdf.errors.js";

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
      details,
      occurrence_types (
        title,
        code,
        daily_template
      )
    `,
    )
    .eq("id", occurrenceId)
    .maybeSingle();

  if (error) {
    console.error("[getOccurrenceForPdf] supabase error:", error);
    throw new AppError(
      500,
      "Falha ao buscar ocorrência",
      "OCCURRENCE_QUERY_FAILED",
    );
  }

  if (!data) {
    throw new AppError(
      404,
      "Ocorrência não encontrada",
      "OCCURRENCE_NOT_FOUND",
    );
  }

  // normaliza details → extra
  let extra: any = null;

  if (typeof data.details === "string") {
    try {
      extra = JSON.parse(data.details);
    } catch {
      extra = null;
    }
  } else {
    extra = data.details;
  }

  console.log("DEBUG OCCURRENCE DETAILS:", data.details);
  console.log("DEBUG EXTRA PARSED:", extra);
  console.log("DEBUG VELOCIDADE:", extra?.velocidade);

  const type = (data as any).occurrence_types;

  return {
    id: data.id,
    typeId: data.type_id,

    typeTitle: type?.title ?? null,
    typeCode: type?.code ?? null,
    dailyTemplate: type?.daily_template ?? null,

    eventDate: data.event_date ?? null,
    tripDate: data.trip_date ?? "",
    startTime: data.start_time ?? "",
    endTime: data.end_time ?? "",

    vehicleNumber: data.vehicle_number,
    baseCode: data.base_code,
    lineLabel: data.line_label ?? null,
    place: data.place ?? null,

    reportText: "",

    extra,
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
    .select(
      `
      id,
      sort_order,
      storage_path,
      caption,
      link_texto,
      link_url,
      created_at
`,
    )
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
    mimeType: null,
    caption: e.caption,
    linkTexto: e.link_texto,
    linkUrl: e.link_url,
    sortOrder: e.sort_order ?? null,
  }));
}
