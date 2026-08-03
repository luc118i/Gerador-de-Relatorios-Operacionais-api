-- Horário de sessão previsto no ponto (HH:mm), vindo do esquema operacional
-- (ANALISE_VIAGEM/ESQUEMA_PONTOS.horario_comercial) — usado no relatório de
-- Excesso de Permanência pra mostrar o horário previsto ao lado da linha.
ALTER TABLE occurrences
  ADD COLUMN IF NOT EXISTS session_time text;
