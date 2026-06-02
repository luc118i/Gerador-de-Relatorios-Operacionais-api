/**
 * Seed: importa LOCAIS LIFE - DISTANCIAS.csv → tabela route_distances_cache
 *
 * Pré-requisito: seed-locais.ts já executado (precisa dos locais.id)
 *
 * Uso:
 *   npx tsx scripts/seed-distancias.ts [caminho-do-csv]
 *
 * Padrão: ../../ANALISE_VIAGEM/LOCAIS LIFE - DISTANCIAS.csv
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

async function buildCodigoToIdMap(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("locais")
    .select("id, codigo")
    .not("codigo", "is", null);

  if (error) throw new Error(`Erro ao buscar locais: ${error.message}`);

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    if (row.codigo) map.set(String(row.codigo).trim(), row.id as number);
  }
  return map;
}

async function main() {
  const csvPath = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(__dirname, "../../ANALISE_VIAGEM/LOCAIS LIFE - DISTANCIAS.csv");

  console.log(`📂 Lendo: ${csvPath}`);

  const raw = readFileSync(csvPath, "utf-8");
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  const dataLines = lines.slice(1);
  console.log(`📊 ${dataLines.length} linhas encontradas`);

  console.log("🔍 Carregando mapa codigo → locais.id...");
  const codigoMap = await buildCodigoToIdMap();
  console.log(`   ${codigoMap.size} locais encontrados no banco`);

  const rowsMap = new Map<string, object>();
  let skipped = 0;

  for (const line of dataLines) {
    const cols = line.split(",");
    if (cols.length < 3) continue;

    const codA    = String(cols[0] ?? "").trim();
    const codB    = String(cols[1] ?? "").trim();
    const parsed  = parseCSVLine(line);
    const kmRaw   = String(parsed[2] ?? "").replace(",", ".").trim();
    const tipoVia = String(parsed[3] ?? "").trim() || null;

    const distKm = parseFloat(kmRaw);
    if (isNaN(distKm)) { skipped++; continue; }

    const localAId = codigoMap.get(codA);
    const localBId = codigoMap.get(codB);

    if (!localAId || !localBId) {
      skipped++;
      continue;
    }

    // Última ocorrência vence em caso de duplicata no CSV
    rowsMap.set(`${localAId}:${localBId}`, {
      local_a_id: localAId,
      local_b_id: localBId,
      dist_km:    distKm,
      tipo_via:   tipoVia,
      updated_at: new Date().toISOString(),
    });
  }

  const rows = Array.from(rowsMap.values());
  console.log(`✅ ${rows.length} pares válidos | ⚠️  ${skipped} ignorados (código não encontrado ou km inválido)`);

  if (rows.length === 0) {
    console.log("ℹ️  Nada a inserir. Verifique se seed-locais.ts foi executado antes.");
    return;
  }

  // Upsert em lotes de 100
  const BATCH = 100;
  let total = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("route_distances_cache")
      .upsert(batch, { onConflict: "local_a_id,local_b_id", ignoreDuplicates: false })
      .select("id");

    if (error) {
      console.error(`❌ Erro no lote ${i}–${i + BATCH}:`, error.message);
      process.exit(1);
    }

    total += data?.length ?? 0;
    process.stdout.write(`\r  → ${i + batch.length}/${rows.length} processados...`);
  }

  console.log(`\n\n🎉 Concluído: ${total} distâncias upsertadas.`);
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

main().catch(err => { console.error(err); process.exit(1); });
