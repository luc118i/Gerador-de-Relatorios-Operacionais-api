-- Se o motorista foi questionado (via WhatsApp, "Perguntar ao motorista"
-- em tempo_permanencia.html — aba Excedências nos pontos de apoio) antes
-- do relatório de excesso de permanência ser gerado pra esse ponto — pra
-- deixar isso registrado no PDF/histórico, não só na tela. Valores usados
-- pelo front-end: "ENVIADA" (mensagem mandada), "PULADA" (usuário pulou a
-- pergunta manualmente), ou NULL (rodoviária, que não tem esse fluxo).
ALTER TABLE occurrence_points
  ADD COLUMN motorista_questionado text;
