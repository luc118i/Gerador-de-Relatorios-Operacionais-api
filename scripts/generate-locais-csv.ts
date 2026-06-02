/**
 * Gera locais-ready.csv pronto para upload direto no Supabase.
 *
 * Transformações aplicadas:
 *  - Renomeia colunas para os nomes da tabela
 *  - Converte flags (F/T/S/N) para true/false
 *  - Remove linhas sem lat/lng válidos
 *  - Remove as 17 colunas irrelevantes do CSV original
 *  - Garante separador decimal "." (alguns campos usam ",")
 *
 * Uso:
 *   npx tsx scripts/generate-locais-csv.ts [entrada] [saida]
 *
 * Padrão entrada: ../../ANALISE_VIAGEM/LOCAIS LIFE - LOCAIS.csv
 * Padrão saída:   ../../ANALISE_VIAGEM/locais-ready.csv
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Índices 0-based conforme SheetsService.js
const COL = {
  CODIGO:        0,
  DESC_RESUMIDA: 2,
  DESCRICAO:     3,
  TIPO:          5,
  RAIO:          7,
  VEL:           9,
  ATIVO:        13,
  PEDAGIO:      14,
  RODOVIARIA:   15,
  GARAGEM:      17,
  LATITUDE:     24,
  LONGITUDE:    25,
} as const;

function isTrueFlag(val: string): boolean {
  const v = String(val ?? "").trim().toUpperCase();
  return v === "T" || v === "S" || v === "1" || v === "Y";
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function main() {
  const inputPath = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(__dirname, "../../ANALISE_VIAGEM/LOCAIS LIFE - LOCAIS.csv");

  const outputPath = process.argv[3]
    ? resolve(process.argv[3])
    : resolve(__dirname, "../../ANALISE_VIAGEM/locais-ready.csv");

  console.log(`📂 Lendo:  ${inputPath}`);

  const raw = readFileSync(inputPath, "utf-8");
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  const dataLines = lines.slice(1); // pula cabeçalho

  const outputLines: string[] = [];

  // Cabeçalho exato com nomes das colunas da tabela
  outputLines.push("nome,sigla,codigo,tipo,vel_max_kmh,raio_m,ativo,pedagio,rodoviaria,garagem,lat,lng");

  let valid = 0;
  let skipped = 0;

  for (const line of dataLines) {
    const cols = parseCSVLine(line);
    if (cols.length < 26) { skipped++; continue; }

    const lat = parseFloat(String(cols[COL.LATITUDE]).replace(",", "."));
    const lng = parseFloat(String(cols[COL.LONGITUDE]).replace(",", "."));

    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) { skipped++; continue; }

    const codigo = String(cols[COL.CODIGO] ?? "").trim();
    if (!codigo) { skipped++; continue; }

    const nome   = String(cols[COL.DESCRICAO]     ?? "").trim();
    const sigla  = String(cols[COL.DESC_RESUMIDA] ?? "").trim();
    const tipo   = String(cols[COL.TIPO]          ?? "").trim();
    const vel    = parseFloat(String(cols[COL.VEL] ?? "0").replace(",", ".")) || 0;
    const raio   = parseFloat(String(cols[COL.RAIO] ?? "0").replace(",", ".")) || 0;

    const ativo      = isTrueFlag(String(cols[COL.ATIVO]      ?? "")) ? "true" : "false";
    const pedagio    = isTrueFlag(String(cols[COL.PEDAGIO]    ?? "")) ? "true" : "false";
    const rodoviaria = isTrueFlag(String(cols[COL.RODOVIARIA] ?? "")) ? "true" : "false";
    const garagem    = isTrueFlag(String(cols[COL.GARAGEM]    ?? "")) ? "true" : "false";

    const row = [
      csvEscape(nome),
      csvEscape(sigla),
      csvEscape(codigo),
      csvEscape(tipo),
      String(vel),
      String(raio),
      ativo,
      pedagio,
      rodoviaria,
      garagem,
      String(lat),
      String(lng),
    ].join(",");

    outputLines.push(row);
    valid++;
  }

  writeFileSync(outputPath, outputLines.join("\n"), "utf-8");

  console.log(`✅ ${valid} locais válidos exportados`);
  console.log(`⚠️  ${skipped} linhas ignoradas (sem coordenadas ou código vazio)`);
  console.log(`📄 Arquivo gerado: ${outputPath}`);
  console.log(`\nColunas do arquivo gerado:`);
  console.log(`  nome, sigla, codigo, tipo, vel_max_kmh, raio_m,`);
  console.log(`  ativo, pedagio, rodoviaria, garagem, lat, lng`);
}

main();
