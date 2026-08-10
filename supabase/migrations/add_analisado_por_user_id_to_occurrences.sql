-- `analisado_por` (texto livre) continua sendo a fonte de exibição/relatório
-- e a única coisa preenchida por ocorrências importadas via GAS (sem sessão
-- de usuário). `analisado_por_user_id` é um vínculo opcional e best-effort
-- com o usuário logado no app no momento em que o campo foi definido — não
-- validado por JWT (a API não verifica token hoje), mas estável a rename de
-- perfil, ao contrário do texto. Ranking/filtro por autor devem preferir
-- este campo quando presente e cair pro nome normalizado como fallback.
ALTER TABLE occurrences
  ADD COLUMN IF NOT EXISTS analisado_por_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_occurrences_analisado_por_user_id
  ON occurrences (analisado_por_user_id);
