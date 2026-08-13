-- Adiciona coluna telefone (WhatsApp do gestor/responsável) na tabela
-- base_responsaveis — usado pro envio do relatório diário de ocorrências
-- por base (ver relatorio-diario.tsx / managerReport.ts no front).
ALTER TABLE base_responsaveis ADD COLUMN IF NOT EXISTS telefone text;
