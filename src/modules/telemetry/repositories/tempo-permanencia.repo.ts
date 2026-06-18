import { supabaseAdmin } from "../../../core/infra/supabaseAdmin.js";
import { normalizeText } from "../../../shared/normalizer/index.js";

/** Mapa: ORIGEM normalizada → tempo de permanência permitido (em minutos). */
export type TempoPermanenciaMap = Map<string, number>;

/**
 * Extrai ORIGEM e tempo permitido (minutos) de uma linha da tabela,
 * tolerante a variações de nome de coluna (com/sem acento, snake_case).
 * Retorna null quando a linha não tem origem ou tempo válido.
 */
function parseRow(row: Record<string, unknown>): { origem: string; minutos: number } | null {
  const origem = String(row["ORIGEM"] ?? row["origem"] ?? "").trim();

  const minutos = Number(
    row["Tempo de Permanencia"] ??
      row["Tempo de Permanência"] ??
      row["tempo_permanencia"] ??
      row["tempo"],
  );

  if (!origem || !Number.isFinite(minutos) || minutos <= 0) return null;
  return { origem, minutos: Math.round(minutos) };
}

/**
 * Lê a tabela TEMPO_PERMANENCIA (colunas ORIGEM e "Tempo de Permanencia")
 * e devolve um mapa por ORIGEM normalizada → minutos permitidos.
 *
 * Tolerante a variações de nome de coluna (com/sem acento, snake_case),
 * para não quebrar caso o schema seja ajustado depois.
 */
export async function getTempoPermanenciaMap(): Promise<TempoPermanenciaMap> {
  const { data, error } = await supabaseAdmin.from("TEMPO_PERMANENCIA").select("*");
  if (error) throw new Error(`getTempoPermanenciaMap: ${error.message}`);

  const map: TempoPermanenciaMap = new Map();

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const parsed = parseRow(row);
    if (!parsed) continue;
    map.set(normalizeText(parsed.origem), parsed.minutos);
  }

  return map;
}

export interface TempoPermanenciaItem {
  origem: string;
  tempoPermanenciaMin: number;
}

/**
 * Lista os pontos cadastrados em TEMPO_PERMANENCIA para alimentar o
 * dropdown "Local da Parada" do formulário de ocorrência.
 */
export async function listTempoPermanencia(search?: string): Promise<TempoPermanenciaItem[]> {
  const { data, error } = await supabaseAdmin.from("TEMPO_PERMANENCIA").select("*");
  if (error) throw new Error(`listTempoPermanencia: ${error.message}`);

  const termo = search ? normalizeText(search) : null;

  const itens: TempoPermanenciaItem[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const parsed = parseRow(row);
    if (!parsed) continue;
    if (termo && !normalizeText(parsed.origem).includes(termo)) continue;
    itens.push({ origem: parsed.origem, tempoPermanenciaMin: parsed.minutos });
  }

  itens.sort((a, b) => a.origem.localeCompare(b.origem, "pt-BR"));
  return itens;
}
