import { findLocaisForMatching } from "./repositories/telemetry-locais.repo.js";
import { saveAnalysis } from "./repositories/telemetry-analyses.repo.js";
import { parse } from "./services/telemetry-parser.service.js";
import { enrich } from "./services/telemetry-enrichment.service.js";
import { analyze } from "./services/telemetry-analysis.service.js";
import { compareRoute } from "./services/telemetry-comparison.service.js";
import { findPointsByScheme } from "../route-schemes/route-schemes.repo.js";
import type { TelemetryAnalysisResult } from "./types/telemetry.types.js";
import type { RouteComparisonResult } from "../route-schemes/types/route-schemes.types.js";

export interface AnalyzeOptions {
  schemeId?: string;
}

export interface FullAnalysisResult {
  analysis: TelemetryAnalysisResult;
  comparison: RouteComparisonResult | null;
}

export interface AnalyzeResult extends FullAnalysisResult {
  id: string;
}

export async function analyzeCSV(csvText: string, opts: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const locais    = await findLocaisForMatching();
  const rawPoints = parse(csvText);
  const enriched  = enrich(rawPoints, locais);
  const analysis  = analyze(enriched);

  let comparison: RouteComparisonResult | null = null;

  if (opts.schemeId) {
    const schemePointsRaw = await findPointsByScheme(opts.schemeId);
    const schemePoints = schemePointsRaw.map((p: any) => ({
      id:               p.id as string,
      schemeId:         p.scheme_id as string,
      ordem:            p.ordem as number,
      localId:          p.local_id as number | null,
      nomePonto:        p.nome_ponto as string,
      tipo:             p.tipo as string | null,
      horarioComercial: p.horario_comercial as string | null,
      tempoLocalMin:    p.tempo_local_min as number | null,
      tipoTrecho:       p.tipo_trecho as string | null,
    }));

    comparison = compareRoute(schemePoints, enriched);
  }

  const result: FullAnalysisResult = { analysis, comparison };

  const id = await saveAnalysis({
    result,
    ...(opts.schemeId ? { schemeId: opts.schemeId } : {}),
  });

  return { ...result, id };
}
