-- Central de Ocorrências (Fase 1) — organização em blocos por estado de
-- tratamento, prioridade e timeline de auditoria. Tudo aditivo: o schema base
-- de `occurrences` é gerido em parte fora deste repo, então nenhuma coluna
-- existente é alterada.
--
-- `workflow_status` é o estado da ocorrência NO QUADRO da Central e é
-- independente de `tratativa` (medida disciplinar) e de `solucionado` (espelho
-- do RIZER). O Apps Script / Notion continua derivando o "Status" dele próprio
-- a partir de `tratativa` (_statusPorTratativa) — este campo não o afeta.

ALTER TABLE occurrences
  ADD COLUMN IF NOT EXISTS workflow_status text NOT NULL DEFAULT 'PENDENTE'
    CHECK (workflow_status IN
      ('PENDENTE', 'EM_TRATAMENTO', 'AGUARDANDO_RETORNO', 'TRATADA', 'CANCELADA', 'ARQUIVADA')),
  ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'MEDIA'
    CHECK (prioridade IN ('CRITICA', 'ALTA', 'MEDIA', 'BAIXA'));

-- Backfill a partir dos sinais que já existem: solucionado no RIZER = tratada;
-- com tratativa definida = já em tratamento; senão, pendente. Só toca linhas
-- que ainda estão no default (idempotente em reexecução).
UPDATE occurrences SET workflow_status =
  CASE
    WHEN solucionado THEN 'TRATADA'
    WHEN tratativa IS NOT NULL THEN 'EM_TRATAMENTO'
    ELSE 'PENDENTE'
  END
WHERE workflow_status = 'PENDENTE';

CREATE INDEX IF NOT EXISTS idx_occurrences_workflow_status ON occurrences(workflow_status);
CREATE INDEX IF NOT EXISTS idx_occurrences_event_date ON occurrences(event_date);

-- Timeline de auditoria da ocorrência (append-only). Escrita pela camada de
-- serviço (occurrences.service/repo), não por trigger — segue o padrão do
-- módulo. `action`: CRIADA | STATUS | PRIORIDADE | TRATATIVA | RELATORIO | NOTA.
-- `actor_user_id`/`actor_nome` são rastro best-effort vindos do client (mesmo
-- modelo de PATCH /occurrences/:id/tratativa), não identidade validada.
CREATE TABLE IF NOT EXISTS occurrence_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id uuid NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  actor_nome    text,
  action        text NOT NULL,
  from_value    text,
  to_value      text,
  note          text
);

CREATE INDEX IF NOT EXISTS idx_occurrence_history_occ
  ON occurrence_history(occurrence_id, created_at);
