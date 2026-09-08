import {
  clearCoverFiles,
  deleteSetting,
  getSetting,
  upsertSetting,
  uploadCoverFile,
} from "./central-settings.repo.js";
import { AppError } from "../reports/pdf/pdf.errors.js";

const COVER_KEY = "cover_image";

const DEFAULT_POS_Y = 50; // 0 = topo, 100 = base
const DEFAULT_OPACITY = 0.16;
const MIN_OPACITY = 0.03;
const MAX_OPACITY = 0.5;

export type CoverResult = {
  url: string | null;
  updatedAt: string | null;
  /** enquadramento vertical (object-position Y, %) */
  posY: number;
  /** opacidade da imagem no quadro (0–1) */
  opacity: number;
};

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

function readNum(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function toResult(
  value: Record<string, unknown> | undefined,
  updatedAt: string | null,
): CoverResult {
  const url = typeof value?.url === "string" ? (value.url as string) : null;
  return {
    url,
    updatedAt,
    posY: clamp(readNum(value?.posY, DEFAULT_POS_Y), 0, 100),
    opacity: clamp(
      readNum(value?.opacity, DEFAULT_OPACITY),
      MIN_OPACITY,
      MAX_OPACITY,
    ),
  };
}

export async function getCover(): Promise<CoverResult> {
  try {
    const row = await getSetting(COVER_KEY);
    return toResult(row?.value, row?.updated_at ?? null);
  } catch (err) {
    // Cosmético — se a tabela ainda não existe (migration não aplicada) ou
    // qualquer outra falha de leitura, o quadro só fica sem plano de fundo.
    console.warn("[central-settings:getCover] falhou, seguindo sem cover:", err);
    return toResult(undefined, null);
  }
}

export async function setCover(
  buffer: Buffer,
  contentType: string,
  updatedBy: string | null,
): Promise<CoverResult> {
  await clearCoverFiles();
  const url = await uploadCoverFile(buffer, contentType);
  // imagem nova → volta o enquadramento/opacidade pro padrão
  const value = { url, posY: DEFAULT_POS_Y, opacity: DEFAULT_OPACITY };
  await upsertSetting(COVER_KEY, value, updatedBy);
  return toResult(value, new Date().toISOString());
}

export async function patchCover(
  patch: { posY?: number; opacity?: number },
  updatedBy: string | null,
): Promise<CoverResult> {
  const row = await getSetting(COVER_KEY);
  const current = row?.value ?? {};
  if (typeof current.url !== "string") {
    throw new AppError(400, "Nenhuma imagem de fundo definida.", "NO_COVER");
  }
  const next: Record<string, unknown> = { ...current };
  if (patch.posY !== undefined) next.posY = clamp(patch.posY, 0, 100);
  if (patch.opacity !== undefined) {
    next.opacity = clamp(patch.opacity, MIN_OPACITY, MAX_OPACITY);
  }
  await upsertSetting(COVER_KEY, next, updatedBy);
  return toResult(next, new Date().toISOString());
}

export async function clearCover(updatedBy: string | null): Promise<CoverResult> {
  await clearCoverFiles();
  try {
    await deleteSetting(COVER_KEY);
  } catch (err) {
    console.warn("[central-settings:clearCover] deleteSetting falhou:", err);
  }
  void updatedBy;
  return toResult(undefined, null);
}
