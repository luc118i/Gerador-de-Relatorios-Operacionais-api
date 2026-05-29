-- Garante que locais.id tem sequência automática para o seed funcionar sem fornecer id
DO $$
BEGIN
  -- Só cria a sequência se o id ainda não tem default
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'locais'
      AND column_name = 'id'
      AND column_default IS NOT NULL
  ) THEN
    CREATE SEQUENCE IF NOT EXISTS locais_id_seq;
    -- Posiciona a sequência no máximo id existente (ou 1 se tabela vazia)
    PERFORM setval('locais_id_seq', COALESCE((SELECT MAX(id) FROM locais), 0) + 1, false);
    ALTER TABLE locais ALTER COLUMN id SET DEFAULT nextval('locais_id_seq');
  END IF;
END;
$$;
