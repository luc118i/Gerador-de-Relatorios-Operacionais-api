-- Pontos de parada de uma ocorrência EXCESSO_PERMANENCIA. Antes, cada parada
-- excedida virava uma ocorrência própria (mesmo motorista/veículo/viagem
-- gerava N ocorrências → N envios ao RIZER). Agora uma única ocorrência pode
-- guardar N paradas aqui; start_time/end_time/place em "occurrences" passam a
-- ser um resumo (menor entrada/maior saída/"N paradas") quando há mais de 1
-- ponto. Ocorrências com 1 ponto só (fluxo individual, outros typeCodes)
-- continuam sem linhas nesta tabela — o resumo bate com o ponto único.
CREATE TABLE occurrence_points (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id   uuid NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  seq             int NOT NULL,
  place           text NOT NULL,
  start_time      text NOT NULL, -- HH:mm
  end_time        text NOT NULL, -- HH:mm
  cidade          text,
  uf              text,
  regiao          text,
  permanencia_min int,
  permitido_min   int,
  excedente_min   int,
  lat             numeric,
  lng             numeric,
  UNIQUE (occurrence_id, seq)
);

CREATE INDEX idx_occurrence_points_occurrence ON occurrence_points(occurrence_id);
