-- Rastreia quantas vezes a notificação via WhatsApp foi enviada por
-- motorista (posição 1 ou 2) de uma ocorrência — usado pelo botão de
-- WhatsApp na Home/preview pra virar um contador em vez de resetar a cada
-- envio.
ALTER TABLE occurrences
  ADD COLUMN IF NOT EXISTS whatsapp_sent_count_1 integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS whatsapp_last_sent_1_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_sent_count_2 integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS whatsapp_last_sent_2_at timestamptz;

-- Incremento atômico (evita race condition de dois cliques quase
-- simultâneos lendo o mesmo count antes de gravar).
CREATE OR REPLACE FUNCTION increment_whatsapp_sent(p_occurrence_id uuid, p_position int)
RETURNS TABLE (count integer, last_sent_at timestamptz)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_position = 1 THEN
    RETURN QUERY
      UPDATE occurrences
      SET whatsapp_sent_count_1 = whatsapp_sent_count_1 + 1,
          whatsapp_last_sent_1_at = now()
      WHERE id = p_occurrence_id
      RETURNING whatsapp_sent_count_1, whatsapp_last_sent_1_at;
  ELSIF p_position = 2 THEN
    RETURN QUERY
      UPDATE occurrences
      SET whatsapp_sent_count_2 = whatsapp_sent_count_2 + 1,
          whatsapp_last_sent_2_at = now()
      WHERE id = p_occurrence_id
      RETURNING whatsapp_sent_count_2, whatsapp_last_sent_2_at;
  ELSE
    RAISE EXCEPTION 'posição inválida: %', p_position;
  END IF;
END;
$$;
