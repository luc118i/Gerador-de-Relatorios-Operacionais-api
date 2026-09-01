-- "Ocorrências Pendentes de Tratamento" (Centro de Relatórios).
-- `solucionado` espelha o campo "Status" da seção "Status e Soluções CCO" do
-- RIZER (#input_status: value "1" = Solucionado). É um cache local do estado
-- do RIZER — atualizado sob demanda pelo botão "Verificar no RIZER"
-- (POST /reports/rizer/sync-solucionado), nunca escrito pelo fluxo de criação.
-- `solucionado_verificado_em` guarda quando essa verificação rodou pela última
-- vez, pra UI mostrar "última verificação" e distinguir "pendente" de
-- "nunca verificado".
ALTER TABLE occurrences
  ADD COLUMN IF NOT EXISTS solucionado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS solucionado_verificado_em timestamptz;
