-- Configuração compartilhada da Central de Ocorrências (key/value).
-- Primeira chave: `cover_image` — imagem de fundo do cabeçalho.

create table if not exists public.central_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

comment on table public.central_settings is
  'Config compartilhada da Central de Ocorrencias (key/value).';

-- Bucket público para assets da Central (imagem de fundo, etc.).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'central-assets',
  'central-assets',
  true,
  8388608, -- 8 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
