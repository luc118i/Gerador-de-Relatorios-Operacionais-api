-- Log de autoria do cadastro de motorista.
--
-- `criado_por` (texto livre) é o nome de exibição de quem cadastrou o motorista
-- pelo app — fonte de exibição na ficha do motorista. `criado_por_user_id` é um
-- vínculo opcional e best-effort com o usuário logado no momento do cadastro:
-- não validado por JWT (a API não verifica token hoje), mas estável a rename de
-- perfil, ao contrário do texto. Mesmo padrão de analisado_por / analisado_por_user_id
-- nas ocorrências.
--
-- Nulo para motoristas criados antes desta migração ou sincronizados via GAS
-- (POST /drivers/upsert), que não têm sessão de usuário.
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS criado_por text,
  ADD COLUMN IF NOT EXISTS criado_por_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_drivers_criado_por_user_id
  ON drivers (criado_por_user_id);
