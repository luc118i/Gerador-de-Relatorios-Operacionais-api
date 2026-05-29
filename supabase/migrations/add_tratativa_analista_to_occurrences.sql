ALTER TABLE occurrences
  ADD COLUMN IF NOT EXISTS tratativa text CHECK (tratativa IN ('SUSPEICAO', 'ADVERTENCIA', 'VALE', 'REGISTRO')),
  ADD COLUMN IF NOT EXISTS analisado_por text;
