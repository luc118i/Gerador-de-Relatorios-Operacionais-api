-- Links públicos revogáveis para a Ficha de Ocorrência.
-- O token (não previsível, gerado com crypto.randomBytes) é a chave de acesso;
-- `active` liga/desliga; `sections` controla o que aparece na view pública.

create table if not exists public.occurrence_shares (
  token         text primary key,
  occurrence_id uuid not null references public.occurrences(id) on delete cascade,
  active        boolean not null default true,
  sections      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  created_by    text,
  revoked_at    timestamptz
);

create index if not exists occurrence_shares_occ_idx
  on public.occurrence_shares (occurrence_id);

comment on table public.occurrence_shares is
  'Links públicos revogáveis da Ficha de Ocorrência (token + seções visíveis).';
