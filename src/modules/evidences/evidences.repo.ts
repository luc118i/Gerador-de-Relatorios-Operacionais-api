import { supabaseAdmin } from "../../core/infra/supabaseAdmin";
import { ENV } from "../../core/config/env";

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
}) {
  const { data, error } = await supabaseAdmin
    .from("occurrence_evidences")
    .insert({
      occurrence_id: args.occurrenceId,
      sort_order: args.sortOrder,
      storage_path: args.storagePath,
      caption: args.caption ?? null,
    })
    .select("id, occurrence_id, sort_order, storage_path, caption, created_at")
    .single();

  if (error) throw error;
  return data;
}

export async function listEvidencesByOccurrence(occurrenceId: string) {
  const { data, error } = await supabaseAdmin
    .from("occurrence_evidences")
    .select("id, sort_order, storage_path, caption, created_at")
    .eq("occurrence_id", occurrenceId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getSignedUrl(storagePath: string) {
  const { data, error } = await supabaseAdmin.storage
    .from(ENV.SUPABASE_BUCKET)
    .createSignedUrl(storagePath, ENV.SIGNED_URL_TTL_SECONDS);

  if (error) throw error;
  return data.signedUrl;
}
