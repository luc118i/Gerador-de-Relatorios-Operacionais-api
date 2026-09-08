import {
  clearCoverFiles,
  deleteSetting,
  getSetting,
  upsertSetting,
  uploadCoverFile,
} from "./central-settings.repo.js";

const COVER_KEY = "cover_image";

export type CoverResult = { url: string | null; updatedAt: string | null };

export async function getCover(): Promise<CoverResult> {
  try {
    const row = await getSetting(COVER_KEY);
    const url =
      typeof row?.value?.url === "string" ? (row.value.url as string) : null;
    return { url, updatedAt: row?.updated_at ?? null };
  } catch (err) {
    // Cosmético — se a tabela ainda não existe (migration não aplicada) ou
    // qualquer outra falha de leitura, o quadro só fica sem plano de fundo.
    console.warn("[central-settings:getCover] falhou, seguindo sem cover:", err);
    return { url: null, updatedAt: null };
  }
}

export async function setCover(
  buffer: Buffer,
  contentType: string,
  updatedBy: string | null,
): Promise<CoverResult> {
  await clearCoverFiles();
  const url = await uploadCoverFile(buffer, contentType);
  await upsertSetting(COVER_KEY, { url }, updatedBy);
  return { url, updatedAt: new Date().toISOString() };
}

export async function clearCover(updatedBy: string | null): Promise<CoverResult> {
  await clearCoverFiles();
  try {
    await deleteSetting(COVER_KEY);
  } catch (err) {
    console.warn("[central-settings:clearCover] deleteSetting falhou:", err);
  }
  void updatedBy;
  return { url: null, updatedAt: null };
}
