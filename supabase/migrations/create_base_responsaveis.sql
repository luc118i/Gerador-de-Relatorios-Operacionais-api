create table if not exists base_responsaveis (
  sigla        text primary key,
  responsavel  text not null default '',
  visibilidade text not null default ''
);
