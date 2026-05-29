import { supabaseAdmin } from "../../../core/infra/supabaseAdmin.js";
import type { FullAnalysisResult } from "../telemetry.service.js";

export interface SaveAnalysisInput {
  result: FullAnalysisResult;
  schemeId?: string;
}

export interface AnalysisSummaryRow {
  id: string;
  veiculo: string;
  motorista: string;
  data_viagem: string;
  total_pontos: number;
  total_km: number;
  tempo_total_min: number;
  velocidade_media: number;
  total_alertas: number;
  alertas_criticos: number;
  pontos_nao_id: number;
  scheme_id: string | null;
  created_at: string;
}

export interface AnalysisFullRow extends AnalysisSummaryRow {
  data_fim: string | null;
  maior_parada: unknown;
  points: unknown;
  segments: unknown;
  alerts: unknown;
  comparison: unknown;
}

export async function saveAnalysis(input: SaveAnalysisInput): Promise<string> {
  const { summary } = input.result.analysis;

  const row = {
    veiculo:          summary.veiculo,
    motorista:        summary.motorista,
    data_viagem:      summary.dataViagem,
    data_fim:         summary.dataFim || null,
    scheme_id:        input.schemeId ?? null,
    total_pontos:     summary.totalPontos,
    total_km:         summary.totalKm,
    tempo_total_min:  summary.tempoTotalMin,
    velocidade_media: summary.velocidadeMedia,
    maior_parada:     summary.maiorParada ?? null,
    total_alertas:    summary.totalAlertas,
    alertas_criticos: summary.alertasCriticos,
    pontos_nao_id:    summary.pontosNaoId,
    points:           input.result.analysis.points,
    segments:         input.result.analysis.segments,
    alerts:           input.result.analysis.alerts,
    comparison:       input.result.comparison ?? null,
  };

  const { data, error } = await supabaseAdmin
    .from("telemetry_analyses")
    .insert(row)
    .select("id")
    .single();

  if (error) throw new Error(`Erro ao salvar análise: ${error.message}`);
  return data.id as string;
}

export interface ListAnalysesFilter {
  veiculo: string | undefined;
  motorista: string | undefined;
  dataInicio: string | undefined;
  dataFim: string | undefined;
  page: number;
  limit: number;
}

export async function listAnalyses(filter: ListAnalysesFilter): Promise<{ data: AnalysisSummaryRow[]; total: number }> {
  const { page, limit } = filter;
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from("telemetry_analyses")
    .select(
      "id, veiculo, motorista, data_viagem, total_pontos, total_km, tempo_total_min, velocidade_media, total_alertas, alertas_criticos, pontos_nao_id, scheme_id, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter.veiculo)    query = query.ilike("veiculo", `%${filter.veiculo}%`);
  if (filter.motorista)  query = query.ilike("motorista", `%${filter.motorista}%`);
  if (filter.dataInicio) query = query.gte("data_viagem", filter.dataInicio);
  if (filter.dataFim)    query = query.lte("data_viagem", filter.dataFim);

  const { data, error, count } = await query;

  if (error) throw new Error(`Erro ao listar análises: ${error.message}`);
  return { data: (data ?? []) as AnalysisSummaryRow[], total: count ?? 0 };
}

export async function findAnalysisById(id: string): Promise<AnalysisFullRow | null> {
  const { data, error } = await supabaseAdmin
    .from("telemetry_analyses")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Erro ao buscar análise: ${error.message}`);
  }

  return data as AnalysisFullRow;
}
