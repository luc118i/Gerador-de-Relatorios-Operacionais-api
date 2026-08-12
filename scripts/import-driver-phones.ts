/**
 * Importa telefones de motoristas a partir de um CSV (matricula,nome,phone)
 * e atualiza a coluna `phone` da tabela `drivers`, casando por `code`
 * (matrícula). Não cria motoristas novos — só atualiza quem já existe.
 *
 * Uso:
 *   npx tsx scripts/import-driver-phones.ts [caminho-do-csv]   # dry-run (padrão)
 *   npx tsx scripts/import-driver-phones.ts [caminho-do-csv] --apply
 *
 * Padrão do CSV: scripts/data/drivers_phones_import.csv
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

const APPLY = process.argv.includes("--apply");

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
  const csvPath = process.argv[2] && !process.argv[2].startsWith("--")
    ? resolve(process.argv[2])
    : resolve(__dirname, "data/drivers_phones_import.csv");

  console.log(`📂 Lendo: ${csvPath}`);
  console.log(APPLY ? "⚠️  MODO APLICAR (vai gravar no banco)" : "🔎 MODO DRY-RUN (nada será gravado — use --apply pra gravar)");

  const raw = readFileSync(csvPath, "utf-8");
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  const dataLines = lines.slice(1); // pula cabeçalho: matricula,nome,phone

  console.log(`📊 ${dataLines.length} linhas na planilha`);

  // Agrupa por matrícula pra detectar duplicatas (mesma matrícula, pessoas
  // diferentes) — não dá pra saber qual telefone é o certo, então pula.
  const byMatricula = new Map<string, { nome: string; phone: string }[]>();
  for (const line of dataLines) {
    const [matricula, nome, phone] = parseCSVLine(line);
    if (!matricula) continue;
    const list = byMatricula.get(matricula) ?? [];
    list.push({ nome: nome ?? "", phone: phone ?? "" });
    byMatricula.set(matricula, list);
  }

  const ambiguous = [...byMatricula.entries()].filter(([, rows]) => rows.length > 1);
  if (ambiguous.length > 0) {
    console.log(`\n⚠️  ${ambiguous.length} matrícula(s) duplicada(s) na planilha — PULADAS (não dá pra saber qual telefone é o certo):`);
    for (const [matricula, rows] of ambiguous) {
      console.log(`   - ${matricula}: ${rows.map(r => `${r.nome} (${r.phone || "sem telefone"})`).join(" | ")}`);
    }
  }

  // Busca todos os motoristas ativos do nosso banco pra casar por código.
  const { data: drivers, error } = await supabase
    .from("drivers")
    .select("id, code, name, phone")
    .eq("active", true);

  if (error) {
    console.error("❌ Erro ao buscar motoristas:", error.message);
    process.exit(1);
  }

  const driverByCode = new Map((drivers ?? []).map(d => [String(d.code).trim(), d]));

  const toUpdate: { id: string; code: string; name: string; oldPhone: string | null; newPhone: string }[] = [];
  const notFound: string[] = [];
  const noPhoneInSheet: string[] = [];

  for (const [matricula, rows] of byMatricula) {
    if (rows.length > 1) continue; // ambíguo, já reportado acima

    const row = rows[0]!;
    if (!row.phone) {
      noPhoneInSheet.push(`${matricula} — ${row.nome}`);
      continue;
    }

    const driver = driverByCode.get(matricula);
    if (!driver) {
      notFound.push(`${matricula} — ${row.nome}`);
      continue;
    }

    if (driver.phone === row.phone) continue; // já está igual, nada a fazer

    toUpdate.push({ id: driver.id, code: matricula, name: driver.name, oldPhone: driver.phone, newPhone: row.phone });
  }

  console.log(`\n✅ ${toUpdate.length} motorista(s) do nosso banco terão o telefone atualizado`);
  console.log(`🚫 ${notFound.length} matrícula(s) da planilha não encontradas no nosso banco (não cadastradas ou inativas)`);
  console.log(`➖ ${noPhoneInSheet.length} matrícula(s) sem telefone na planilha (nada a fazer)`);

  if (toUpdate.length > 0) {
    console.log(`\nPrévia (até 20):`);
    for (const u of toUpdate.slice(0, 20)) {
      console.log(`   - [${u.code}] ${u.name}: ${u.oldPhone ?? "—"} → ${u.newPhone}`);
    }
    if (toUpdate.length > 20) console.log(`   ... e mais ${toUpdate.length - 20}`);
  }

  if (!APPLY) {
    console.log(`\n🔎 Dry-run concluído. Rode com --apply pra gravar de verdade.`);
    return;
  }

  console.log(`\n💾 Gravando ${toUpdate.length} atualizações...`);
  let done = 0;
  for (const u of toUpdate) {
    const { error: updErr } = await supabase
      .from("drivers")
      .update({ phone: u.newPhone })
      .eq("id", u.id);
    if (updErr) {
      console.error(`❌ Erro ao atualizar [${u.code}] ${u.name}:`, updErr.message);
      continue;
    }
    done++;
    process.stdout.write(`\r  → ${done}/${toUpdate.length}`);
  }

  console.log(`\n\n🎉 Concluído: ${done} motorista(s) atualizados com telefone.`);
}

main().catch(err => { console.error(err); process.exit(1); });
