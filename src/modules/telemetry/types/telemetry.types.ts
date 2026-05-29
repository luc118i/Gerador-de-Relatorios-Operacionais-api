export type AlertType =
  | "VELOCIDADE_BAIXA"
  | "VELOCIDADE_ALTA"
  | "VELOCIDADE_EXCESSIVA"
  | "PARADA_PROIBIDA"
  | "PARADA_LONGA"
  | "LOCAL_NAO_IDENTIFICADO";

export type AlertLevel = "info" | "attention" | "critical";

export type UploadStatus = "pending" | "processing" | "done" | "error";

export interface TelemetryAlert {
  tipo: AlertType;
  nivel: AlertLevel;
  descricao: string;
  seq?: number;
  trecho?: string;
  distKm?: number;
  tempoMin?: number;
  velocidadeKmh?: number;
  meta?: Record<string, unknown>;
}

export interface RawTripPoint {
  seq: number;
  ponto: string;
  entrada: string;
  saida: string;
  parada_s: number;
  intervalo_s: number;
  veiculo: string;
  funcionario: string;
}

export interface LocalForMatching {
  id: number;
  codigo: string | null;
  descResumida: string;
  descricao: string;
  lat: number | null;
  lng: number | null;
  tipo: string | null;
  vel: number | null;
  raio: number | null;
  pedagio: boolean;
  rodoviaria: boolean;
  garagem: boolean;
}

export interface TelemetryPoint {
  seq: number;
  ponto: string;
  entrada: string | null;
  saida: string | null;
  parada_s: number;
  intervalo_s: number;
  veiculo: string | null;
  funcionario: string | null;
  lat: number | null;
  lng: number | null;
  localId: number | null;
  tipo: string | null;
  velMaxKmh: number | null;
  raioM: number | null;
  pedagio: boolean;
  rodoviaria: boolean;
  garagem: boolean;
  codigo: string | null;
  matched: boolean;
  proibido42?: boolean;
}

export interface TelemetrySegment {
  seq: number;
  de: string;
  para: string;
  deSeq: number;
  paraSeq: number;
  distKm: number | null;
  tempoMin: number | null;
  velocidadeKmh: number | null;
  alertas: TelemetryAlert[];
}

export interface TelemetryAnalysisResult {
  points: TelemetryPoint[];
  segments: TelemetrySegment[];
  alerts: TelemetryAlert[];
  summary: TelemetrySummary;
}

export interface MaiorParada {
  ponto: string;
  duracaoStr: string;
}

export interface TelemetrySummary {
  veiculo: string;
  motorista: string;
  dataViagem: string;
  dataFim: string;
  totalPontos: number;
  totalKm: number;
  tempoTotalMin: number;
  velocidadeMedia: number;
  maiorParada: MaiorParada | null;
  totalAlertas: number;
  alertasCriticos: number;
  pontosNaoId: number;
}
