export const STOP_THRESHOLDS = {
  MIN_PARADA_S: 300,
} as const;

export interface StopLimit {
  esperadoMin: number;
  toleranciaMin: number;
  limiteLongMin: number;
}

export const STOP_LIMITS_BY_TYPE: Record<string, StopLimit> = {
  rodoviaria: { esperadoMin: 15, toleranciaMin: 5, limiteLongMin: 20 },
  garagem:    { esperadoMin: 20, toleranciaMin: 5, limiteLongMin: 25 },
  default:    { esperadoMin: 40, toleranciaMin: 5, limiteLongMin: 45 },
};

export function getStopLimit(flags: { rodoviaria?: boolean; garagem?: boolean }): StopLimit {
  if (flags.rodoviaria) return STOP_LIMITS_BY_TYPE["rodoviaria"]!;
  if (flags.garagem) return STOP_LIMITS_BY_TYPE["garagem"]!;
  return STOP_LIMITS_BY_TYPE["default"]!;
}
