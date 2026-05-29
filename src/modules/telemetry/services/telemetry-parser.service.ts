import { parseDuration } from "../../../shared/time/index.js";
import { normalizeText } from "../../../shared/normalizer/index.js";
import type { RawTripPoint } from "../types/telemetry.types.js";

// Cabeçalhos aceitos por coluna (aliases normalizados sem acentos)
const HEADER_ALIASES: Record<string, string[]> = {
  ponto_controle: ["ponto de controle", "ponto controle", "ponto", "local"],
  entrada:        ["entrada", "data entrada", "dt entrada"],
  saida:          ["saida", "data saida", "dt saida"],
  parada:         ["parada", "tempo parada", "duracao parada"],
  intervalo:      ["intervalo", "tempo intervalo"],
  veiculo:        ["veiculo", "frota", "bus", "onibus"],
  funcionario:    ["funcionario", "motorista", "condutor", "colaborador"],
};

// Fallback por posição para o relatório padrão (Unid.Emp, Veiculo, Ponto, Entrada, Saida, Parada, Intervalo, Funcionario)
const FALLBACK_POSITIONS: Record<string, number> = {
  veiculo: 1, ponto_controle: 2, entrada: 3,
  saida: 4, parada: 5, intervalo: 6, funcionario: 7,
};

export function parse(csvText: string): RawTripPoint[] {
  if (!csvText || csvText.trim() === "") {
    throw new Error("Conteúdo do relatório está vazio.");
  }

  const lines = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nonEmpty = lines.filter((l) => l.trim() !== "");

  if (nonEmpty.length < 2) {
    throw new Error("Relatório não contém dados suficientes.");
  }

  const sep = detectSeparator(nonEmpty[0]!);
  const headerCols = parseCSVLine(nonEmpty[0]!, sep);
  const header = headerCols.map((h) => normalizeText(h));
  const idxMap = buildHeaderIndex(header);

  const points: RawTripPoint[] = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const cols = parseCSVLine(nonEmpty[i]!, sep);
    if (cols.length < 3) continue;

    const get = (key: string): string => {
      const idx = idxMap[key];
      return idx !== undefined ? String(cols[idx] ?? "").trim() : "";
    };

    const entrada = get("entrada");
    const saida   = get("saida");
    if (!entrada && !saida) continue;

    points.push({
      seq:         i,
      ponto:       get("ponto_controle"),
      entrada,
      saida,
      parada_s:    parseDuration(get("parada")),
      intervalo_s: parseDuration(get("intervalo")),
      veiculo:     get("veiculo"),
      funcionario: get("funcionario"),
    });
  }

  if (points.length === 0) {
    throw new Error("Nenhum ponto válido encontrado no relatório.");
  }

  // Ordena cronologicamente por entrada (strings ISO ordenam lexicograficamente)
  points.sort((a, b) => {
    if (!a.entrada) return 1;
    if (!b.entrada) return -1;
    return a.entrada < b.entrada ? -1 : a.entrada > b.entrada ? 1 : 0;
  });

  return points;
}

function detectSeparator(line: string): string {
  const count = (ch: string): number => {
    let n = 0;
    let inQ = false;
    for (const c of line) {
      if (c === '"') inQ = !inQ;
      else if (c === ch && !inQ) n++;
    }
    return n;
  };
  if (count("\t") > 0) return "\t";
  if (count(";") > 0) return ";";
  return ",";
}

function parseCSVLine(line: string, sep: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function buildHeaderIndex(header: string[]): Record<string, number> {
  const idx: Record<string, number> = {};

  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const found = header.indexOf(alias);
      if (found !== -1 && idx[key] === undefined) {
        idx[key] = found;
      }
    }
  }

  // Posições padrão como fallback
  for (const [key, pos] of Object.entries(FALLBACK_POSITIONS)) {
    if (idx[key] === undefined) idx[key] = pos;
  }

  return idx;
}
