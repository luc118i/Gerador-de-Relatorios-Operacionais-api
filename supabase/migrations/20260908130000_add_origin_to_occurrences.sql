-- Distingue ocorrência "de relatório" (fluxo do Gerador de Relatórios, que
-- gera PDF/RIZER/disciplinar) de ocorrência "só para tratar" cadastrada
-- direto na Central de Ocorrências (cadastro rápido ou importação da
-- passagem de serviço do WhatsApp).
--
-- A Home ("Ocorrências do Dia") e as análises de relatório passam a listar
-- só origin = 'REPORT'; a Central mostra as duas.
--
-- Default 'REPORT': todo o histórico veio do fluxo de relatório.

ALTER TABLE occurrences
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'REPORT'
    CHECK (origin IN ('REPORT', 'CENTRAL'));

CREATE INDEX IF NOT EXISTS idx_occurrences_origin ON occurrences(origin);
