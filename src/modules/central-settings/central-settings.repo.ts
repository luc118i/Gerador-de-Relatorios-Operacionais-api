import { supabaseAdmin } from "../../core/infra/supabaseAdmin.js";

const TABLE = "central_settings";
export const CENTRAL_ASSETS_BUCKET = "central-assets";
export const COVER_PREFIX = "cover";

export type CentralSettingRow = {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
  updated_by: string | null;
};

export async function getSetting(key: string): Promise<CentralSettingRow | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("key, value, updated_at, updated_by")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return (data as CentralSettingRow | null) ?? null;
}

export async function upsertSetting(
  key: string,
  value: Record<string, unknown>,
  updatedBy: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from(TABLE)
    .upsert(
      { key, value, updated_by: updatedBy, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw error;
}

export async function deleteSetting(key: string): Promise<void> {
  const { error } = await supabaseAdmin.from(TABLE).delete().eq("key", key);
  if (error) throw error;
}

/** Remove todos os arquivos sob `central-assets/cover/`. */
export async function clearCoverFiles(): Promise<void> {
  const { data, error } = await supabaseAdmin.storage
    .from(CENTRAL_ASSETS_BUCKET)
    .list(COVER_PREFIX, { limit: 100 });
  if (error) return; // pasta inexistente — nada a fazer
  const paths = (data ?? []).map((f) => `${COVER_PREFIX}/${f.name}`);
  if (paths.length) {
    await supabaseAdmin.storage.from(CENTRAL_ASSETS_BUCKET).remove(paths);
  }
}

/** Faz upload da nova imagem e devolve a URL pública (com cache-bust). */
export async function uploadCoverFile(
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const ext =
    contentType === "image/png"
      ? "png"
      : contentType === "image/webp"
        ? "webp"
        : "jpg";
  const stamp = Date.now();
  const path = `${COVER_PREFIX}/${stamp}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(CENTRAL_ASSETS_BUCKET)
    .upload(path, buffer, { contentType, upsert: true, cacheControl: "3600" });
  if (error) {
    console.error("[central-settings:cover] upload falhou:", error);
    throw error;
  }

  const { data } = supabaseAdmin.storage
    .from(CENTRAL_ASSETS_BUCKET)
    .getPublicUrl(path);
  return `${data.publicUrl}?v=${stamp}`;
}
