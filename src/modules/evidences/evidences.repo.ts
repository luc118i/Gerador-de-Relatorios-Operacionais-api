import { supabaseAdmin } from "../../core/infra/supabaseAdmin.js";
import { ENV } from "../../core/config/env.js";
import type { PdfEvidence } from "../reports/pdf/pdf.types.js";
import { AppError } from "../reports/pdf/pdf.errors.js";

export async function uploadFileToBucket(args: {
  occurrenceId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const ext = (args.filename.split(".").pop() || "jpg").toLowerCase();
  const path = `${args.occurrenceId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(ENV.SUPABASE_BUCKET)
    .upload(path, args.buffer, {
      contentType: args.mimeType,
      upsert: false,
    });

  if (error) throw error;
  return path;
}

export async function insertEvidenceRow(args: {
  occurrenceId: string;
  sortOrder: number;
  storagePath: string;
  caption?: string | null;
  linkTexto?: string | null;
  linkUrl?: string | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("occurrence_evidences")
    .insert({
      occurrence_id: args.occurrenceId,
      sort_order: args.sortOrder,
      storage_path: args.storagePath,
      caption: args.caption ?? null,
      link_texto: args.linkTexto ?? null,
      link_url: args.linkUrl ?? null,
    })
    .select(
      "id, occurrence_id, sort_order, storage_path, caption, link_texto, link_url, created_at",
    )
    .single();

  if (error) throw error;
  return data;
}

export async function listEvidencesByOccurrence(
  occurrenceId: string,
): Promise<PdfEvidence[]> {
  const { data, error } = await supabaseAdmin
    .from("occurrence_evidences")
    .select(
      "id, sort_order, storage_path, caption, link_texto, link_url, created_at",
    )
    .eq("occurrence_id", occurrenceId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[listEvidencesByOccurrence] supabase error:", {
      message: error.message,
      details: (error as any).details,
      hint: (error as any).hint,
      code: (error as any).code,
    });
    throw new AppError(
      500,
      "Falha ao buscar evidências",
      "EVIDENCES_QUERY_FAILED",
    );
  }

  return (data ?? []).map((e: any) => ({
    id: e.id,
    storagePath: e.storage_path,
    mimeType: null,
    caption: e.caption ?? null,
    linkTexto: e.link_texto ?? null,
    linkUrl: e.link_url ?? null,
    sortOrder: e.sort_order ?? null,
  }));
}

export async function getSignedUrl(storagePath: string) {
  const { data, error } = await supabaseAdmin.storage
    .from(ENV.SUPABASE_BUCKET)
    .createSignedUrl(storagePath, ENV.SIGNED_URL_TTL_SECONDS);

  if (error) throw error;
  return data.signedUrl;
}
