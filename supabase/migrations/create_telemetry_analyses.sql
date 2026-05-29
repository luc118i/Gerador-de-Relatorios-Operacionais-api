-- Histórico de análises de telemetria
CREATE TABLE telemetry_analyses (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo       text        NOT NULL,
  motorista     text        NOT NULL,
  data_viagem   date        NOT NULL,
  data_fim      timestamptz,
  scheme_id     uuid        REFERENCES route_schemes(id) ON DELETE SET NULL,

  -- Campos do summary para filtragem/listagem sem carregar JSONB
  total_pontos      int            NOT NULL DEFAULT 0,
  total_km          numeric(8, 2)  NOT NULL DEFAULT 0,
  tempo_total_min   numeric(8, 2)  NOT NULL DEFAULT 0,
  velocidade_media  numeric(5, 2)  NOT NULL DEFAULT 0,
  maior_parada      jsonb,
  total_alertas     int            NOT NULL DEFAULT 0,
  alertas_criticos  int            NOT NULL DEFAULT 0,
  pontos_nao_id     int            NOT NULL DEFAULT 0,

  -- Resultado completo
  points      jsonb NOT NULL DEFAULT '[]',
  segments    jsonb NOT NULL DEFAULT '[]',
  alerts      jsonb NOT NULL DEFAULT '[]',
  comparison  jsonb,

  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telemetry_veiculo    ON telemetry_analyses(veiculo);
CREATE INDEX idx_telemetry_data       ON telemetry_analyses(data_viagem DESC);
CREATE INDEX idx_telemetry_motorista  ON telemetry_analyses(motorista);
CREATE INDEX idx_telemetry_created    ON telemetry_analyses(created_at DESC);
