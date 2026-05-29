import type { TelemetryPoint } from "../types/telemetry.types.js";
import type { RouteSchemePoint, RouteComparisonResult, UnvisitedPoint, VisitedPoint } from "../../route-schemes/types/route-schemes.types.js";

export function compareRoute(
  schemePoints: RouteSchemePoint[],
  enrichedTrip: TelemetryPoint[],
): RouteComparisonResult {
  if (schemePoints.length === 0) {
    return {
      schemeId: schemePoints[0]?.schemeId ?? "",
      totalEsperados: 0,
      totalVisitados: 0,
      pontosNaoVisitados: [],
      pontosVisitados: [],
    };
  }

  // Mapa: codigo → ponto realizado (apenas pontos matched com codigo)
  const realizadosMap = new Map<string, TelemetryPoint>();
  for (const pt of enrichedTrip) {
    if (pt.matched && pt.codigo) {
      const chave = pt.codigo.trim();
      if (!realizadosMap.has(chave)) realizadosMap.set(chave, pt);
    }
  }

  const visitados: VisitedPoint[] = [];
  const naoVisitados: UnvisitedPoint[] = [];

  for (const ep of schemePoints) {
    // O localId é a chave de matching — comparamos com codigo do ponto realizado
    const chave = String(ep.localId ?? "").trim();
    const realizado = chave ? realizadosMap.get(chave) : undefined;

    if (realizado) {
      visitados.push({
        idPonto:       String(ep.localId ?? ep.id),
        nomePonto:     ep.nomePonto,
        ordem:         ep.ordem,
        pontoRealizado: realizado.ponto,
        desvioMin:     null,
      });
    } else {
      naoVisitados.push({
        idPonto:   String(ep.localId ?? ep.id),
        nomePonto: ep.nomePonto,
        ordem:     ep.ordem,
      });
    }
  }

  return {
    schemeId:           schemePoints[0]?.schemeId ?? "",
    totalEsperados:     schemePoints.length,
    totalVisitados:     visitados.length,
    pontosNaoVisitados: naoVisitados,
    pontosVisitados:    visitados,
  };
}

export function getUnvisitedPoints(result: RouteComparisonResult): UnvisitedPoint[] {
  return result.pontosNaoVisitados;
}
