export type RelatoData = {
  vehicleNumber: string;
  tripDateLabel: string;

  // Campos para VELOCIDADE
  eventDateLabel?: string; // Data formatada do evento
  horarioEvento?: string; // Horário do evento

  // Campos opcionais
  velocidade?: string; // Velocidade do veículo em km/h
  limite?: string; // Limite permitido de velocidade
  local?: string; // Local do evento
  place?: string; // Local da ocorrência ou parada
  occurrenceDateLabel?: string; // Data da ocorrência formatada
  startTimeLabel?: string; // Horário inicial do evento (formatado)
  endTimeLabel?: string; // Horário final do evento (formatado)
  lineLabel?: string; // Nome da linha
};

export type BuildRelatoArgs = {
  reportText?: string;
  occurrenceType: string;
  data: RelatoData;
};

export type RelatoBuilder = (args: BuildRelatoArgs) => string;
