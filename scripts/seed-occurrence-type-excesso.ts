import "dotenv/config";
import { supabaseAdmin } from "../src/core/infra/supabaseAdmin.js";

const CODE = "EXCESSO_PERMANENCIA";

const daily_template =
  "{driver_lines}\r\n" +
  "OCORRÊNCIA: EXCESSO DE PERMANÊNCIA EM PONTO DE PARADA\r\n" +
  "DATA: {event_date}\r\n" +
  "Horario do evento: {start_time} à {end_time}.\r\n" +
  "Durante a análise das atividades do veículo de número {vehicle_number} na viagem do dia {trip_date}, " +
  "identificamos a permanência superior ao tempo previsto em ponto de parada ({place}).\r\n-";

const whatsapp_template =
  "⚠️ EXCESSO DE PERMANÊNCIA EM PONTO DE PARADA\r\n" +
  "Veículo {vehicle_number} – Base {base_code}\r\n" +
  "Evento em {event_date}, {start_time}–{end_time}\r\n" +
  "Local: {place}\r\n" +
  "📸 Evidências: {evidence_count} foto(s) anexada(s)";

const row = {
  code: CODE,
  title: "Excesso de Permanência",
  daily_template,
  whatsapp_template,
  is_active: true,
};

const { data: existing, error: selErr } = await supabaseAdmin
  .from("occurrence_types")
  .select("id")
  .eq("code", CODE)
  .maybeSingle();

if (selErr) {
  console.error("ERRO ao consultar:", selErr.message);
  process.exit(1);
}

if (existing?.id) {
  const { error } = await supabaseAdmin
    .from("occurrence_types")
    .update(row)
    .eq("id", existing.id);
  if (error) {
    console.error("ERRO ao atualizar:", error.message);
    process.exit(1);
  }
  console.log(`Atualizado occurrence_type ${CODE} (id ${existing.id}).`);
} else {
  const { data, error } = await supabaseAdmin
    .from("occurrence_types")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    console.error("ERRO ao inserir:", error.message);
    process.exit(1);
  }
  console.log(`Inserido occurrence_type ${CODE} (id ${data.id}).`);
}

process.exit(0);
