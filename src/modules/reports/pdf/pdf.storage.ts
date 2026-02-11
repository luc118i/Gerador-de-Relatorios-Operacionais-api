import { supabaseAdmin } from "../../../core/config/supabase.js";
import { AppError } from "./pdf.errors.js";

export async function downloadPrivateFileAsBuffer(
  bucket: string,
  path: string,
): Promise<Buffer> {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .download(path);
  if (error || !data)
    throw new AppError(
      500,
      "Falha ao baixar arquivo do Storage",
      "STORAGE_DOWNLOAD_FAILED",
    );

  // data é Blob (node)
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

export async function uploadPrivatePdf(
  bucket: string,
  path: string,
  pdfBuffer: Buffer,
): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "3600",
    });

  if (error)
    throw new AppError(
      500,
      "Falha ao salvar PDF no Storage",
      "STORAGE_UPLOAD_FAILED",
    );
}

export async function createSignedUrl(
  bucket: string,
  path: string,
  ttlSeconds: number,
): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl)
    throw new AppError(500, "Falha ao gerar signedUrl", "SIGNED_URL_FAILED");
  return data.signedUrl;
}

export async function pdfExists(
  bucket: string,
  path: string,
): Promise<boolean> {
  // Supabase Storage não tem “head” direto; list + match é o mais simples no MVP.
  const parts = path.split("/");
  const fileName = parts.pop()!;
  const prefix = parts.join("/");

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .list(prefix, {
      limit: 100,
      search: fileName,
    });

  if (error) return false;
  return (data ?? []).some((f) => f.name === fileName);
}
