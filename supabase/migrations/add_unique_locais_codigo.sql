-- Garante unicidade no código do local para permitir upsert idempotente no seed
ALTER TABLE locais ADD CONSTRAINT locais_codigo_unique UNIQUE (codigo);
