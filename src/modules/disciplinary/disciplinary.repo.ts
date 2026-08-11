// src/modules/disciplinary/disciplinary.repo.ts
import { supabaseAdmin } from "../../core/infra/supabaseAdmin.js";

export async function getDriverSituationRow(driverId: string) {
  const { data, error } = await supabaseAdmin
    .from("driver_disciplinary_index")
    .select("*")
    .eq("driver_id", driverId)
    .maybeSingle();

  if (error) throw error;
  return data as {
    driver_id: string;
    total_ocorrencias: number;
    recentes_90d: number;
    reincidencias: number;
    indice: number;
    situacao: "REGULAR" | "ATENCAO" | "CRITICO";
  } | null;
}

export async function getDriverMonthlyOccurrencesRows(
  driverId: string,
  sinceISO: string,
) {
  const { data, error } = await supabaseAdmin
    .from("driver_monthly_occurrences")
    .select("*")
    .eq("driver_id", driverId)
    .gte("month", sinceISO)
    .order("month", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Array<{
    driver_id: string;
    month: string;
    total: number;
    advertencias: number;
    vales: number;
    suspensoes: number;
  }>;
}

export type DashboardRow = {
  driver_id: string;
  code: string;
  name: string;
  base: string | null;
  total_ocorrencias: number;
  recentes_90d: number;
  reincidencias: number;
  indice: number;
  situacao: "REGULAR" | "ATENCAO" | "CRITICO";
};

// Dataset completo (motoristas ativos) pra agregação em memória — o volume
// (algumas centenas/poucos milhares de motoristas) não justifica RPC/SQL
// agregado dedicado ainda. Se crescer muito, revisitar.
export async function getDashboardRows(): Promise<DashboardRow[]> {
  const { data, error } = await supabaseAdmin
    .from("driver_disciplinary_dashboard")
    .select("driver_id, code, name, base, total_ocorrencias, recentes_90d, reincidencias, indice, situacao");

  if (error) throw error;
  return (data ?? []) as DashboardRow[];
}

export type DriverOccurrenceHistoryRow = {
  id: string;
  event_date: string;
  place: string | null;
  vehicle_number: string | null;
  tratativa: string | null;
  analisado_por: string | null;
  created_at: string;
  type_code: string | null;
  type_title: string | null;
  // Nome específico da ocorrência (texto livre, geralmente escolhido a
  // partir de occurrence_name_presets — presets sourced do RIZER). Mais
  // preciso que type_title pra casar com o RIZER quando o tipo é genérico.
  occurrence_name: string | null;
  drive_web_view_link: string | null;
};

// Histórico de ocorrências do motorista (seção "Histórico Disciplinar" do
// perfil). Não existe endpoint de ocorrências-por-motorista hoje no módulo
// occurrences — a listagem de lá é só por dia.
export async function getDriverOccurrenceHistoryRows(
  driverId: string,
  limit: number,
): Promise<DriverOccurrenceHistoryRow[]> {
  const { data, error } = await supabaseAdmin
    .from("occurrence_drivers")
    .select(
      `
      occurrences!inner (
        id, event_date, place, vehicle_number, tratativa, analisado_por, created_at,
        drive_web_view_link, occurrence_name,
        occurrence_types:occurrence_types (code, title)
      )
    `,
    )
    .eq("driver_id", driverId)
    .order("event_date", { referencedTable: "occurrences", ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const occ = Array.isArray(row.occurrences) ? row.occurrences[0] : row.occurrences;
    return {
      id: occ.id,
      event_date: occ.event_date,
      place: occ.place ?? null,
      vehicle_number: occ.vehicle_number ?? null,
      tratativa: occ.tratativa ?? null,
      analisado_por: occ.analisado_por ?? null,
      created_at: occ.created_at,
      type_code: occ.occurrence_types?.code ?? null,
      type_title: occ.occurrence_types?.title ?? null,
      occurrence_name: occ.occurrence_name ?? null,
      drive_web_view_link: occ.drive_web_view_link ?? null,
    };
  });
}
