export const SPEED_THRESHOLDS = {
  BAIXA_MAX_KMH: 70,
  IDEAL_MIN_KMH: 80,
  IDEAL_MAX_KMH: 90,
  ALTO_MIN_KMH: 90,
  CRITICO_MIN_KMH: 100,
  DIST_MIN_ALERTA_KM: 3,
  TEMPO_MIN_ALERTA_S: 90,
} as const;

export const DEFAULT_ROAD_SPEEDS: Record<string, number> = {
  BR: 85,
  Est: 75,
  Mun: 60,
  Urb: 45,
};
