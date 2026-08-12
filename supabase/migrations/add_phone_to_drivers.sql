-- Adiciona coluna phone (telefone/WhatsApp) na tabela drivers
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS phone text;
