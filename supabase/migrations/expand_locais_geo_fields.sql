-- Enriquece tabela locais com campos geográficos e operacionais vindos do GAS
ALTER TABLE locais ADD COLUMN IF NOT EXISTS codigo      text;
ALTER TABLE locais ADD COLUMN IF NOT EXISTS lat         numeric(10, 7);
ALTER TABLE locais ADD COLUMN IF NOT EXISTS lng         numeric(10, 7);
ALTER TABLE locais ADD COLUMN IF NOT EXISTS tipo        text;
ALTER TABLE locais ADD COLUMN IF NOT EXISTS vel_max_kmh int;
ALTER TABLE locais ADD COLUMN IF NOT EXISTS raio_m      int;
ALTER TABLE locais ADD COLUMN IF NOT EXISTS ativo       boolean NOT NULL DEFAULT true;
ALTER TABLE locais ADD COLUMN IF NOT EXISTS pedagio     boolean NOT NULL DEFAULT false;
ALTER TABLE locais ADD COLUMN IF NOT EXISTS rodoviaria  boolean NOT NULL DEFAULT false;
ALTER TABLE locais ADD COLUMN IF NOT EXISTS garagem     boolean NOT NULL DEFAULT false;

-- Índices para lookup por código e busca por coordenadas
CREATE INDEX IF NOT EXISTS idx_locais_codigo ON locais(codigo) WHERE codigo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_locais_coords ON locais(lat, lng) WHERE lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_locais_ativo  ON locais(ativo);
