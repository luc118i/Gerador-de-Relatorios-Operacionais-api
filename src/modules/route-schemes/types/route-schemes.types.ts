export interface RouteScheme {
  id: string;
  tripId: string | null;
  nomeLinha: string;
  horario: string | null;
  sentido: string | null;
  active: boolean;
  createdAt: string;
}

export interface RouteSchemePoint {
  id: string;
  schemeId: string;
  ordem: number;
  localId: number | null;
  nomePonto: string;
  tipo: string | null;
  horarioComercial: string | null;
  tempoLocalMin: number | null;
  tipoTrecho: string | null;
}

export interface RouteSpeedConfig {
  id: string;
  schemeId: string;
  tipoVia: "BR" | "Est" | "Mun" | "Urb";
  velKmh: number;
}

export interface RouteComparisonResult {
  schemeId: string;
  totalEsperados: number;
  totalVisitados: number;
  pontosNaoVisitados: UnvisitedPoint[];
  pontosVisitados: VisitedPoint[];
}

export interface UnvisitedPoint {
  idPonto: string;
  nomePonto: string;
  ordem: number;
}

export interface VisitedPoint {
  idPonto: string;
  nomePonto: string;
  ordem: number;
  pontoRealizado: string;
  desvioMin: number | null;
}
