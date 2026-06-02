/**
 * Seed: importa LOCAIS LIFE - LOCAIS.csv → tabela locais
 *
 * Uso:
 *   npx tsx scripts/seed-locais.ts [caminho-do-csv]
 *
 * Padrão: ../../ANALISE_VIAGEM/LOCAIS LIFE - LOCAIS.csv
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Colunas do CSV (0-indexed) — conforme SheetsService.js
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

async function main() {
  const csvPath = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(__dirname, "../../ANALISE_VIAGEM/LOCAIS LIFE - LOCAIS.csv");

  console.log(`📂 Lendo: ${csvPath}`);

  const raw = readFileSync(csvPath, "utf-8");
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());

  // Pula cabeçalho
  const dataLines = lines.slice(1);
  console.log(`📊 ${dataLines.length} linhas encontradas`);

  const rows: object[] = [];

  for (const line of dataLines) {
    const cols = parseCSVLine(line);
    if (cols.length < 26) continue;

    const lat = parseFloat(cols[COL.LATITUDE]!.replace(",", "."));
    const lng = parseFloat(cols[COL.LONGITUDE]!.replace(",", "."));

    // Filtra registros sem coordenadas válidas
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;

    const codigo = String(cols[COL.CODIGO] ?? "").trim();
    if (!codigo) continue;

    rows.push({
      nome:        String(cols[COL.DESCRICAO] ?? "").trim(),
      sigla:       String(cols[COL.DESC_RESUMIDA] ?? "").trim(),
      codigo,
      tipo:        String(cols[COL.TIPO] ?? "").trim() || null,
      vel_max_kmh: parseFloat(cols[COL.VEL]!.replace(",", ".")) || null,
      raio_m:      parseFloat(cols[COL.RAIO]!.replace(",", ".")) || null,
      ativo:       !isTrueFlag(cols[COL.ATIVO]!) ? false : true,
      pedagio:     isTrueFlag(cols[COL.PEDAGIO]!),
      rodoviaria:  isTrueFlag(cols[COL.RODOVIARIA]!),
      garagem:     isTrueFlag(cols[COL.GARAGEM]!),
      lat,
      lng,
    });
  }

  console.log(`✅ ${rows.length} registros com coordenadas válidas`);

  // Upsert em lotes de 100 (idempotente via codigo UNIQUE)
  const BATCH = 100;
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("locais")
      .upsert(batch, { onConflict: "codigo", ignoreDuplicates: false })
      .select("id");

    if (error) {
      console.error(`❌ Erro no lote ${i}–${i + BATCH}:`, error.message);
      process.exit(1);
    }

    inserted += data?.length ?? 0;
    process.stdout.write(`\r  → ${i + batch.length}/${rows.length} processados...`);
  }

  console.log(`\n\n🎉 Concluído: ${inserted} locais upsertados.`);
}

main().catch(err => { console.error(err); process.exit(1); });
