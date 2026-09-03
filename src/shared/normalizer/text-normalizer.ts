// U+0300-U+036F = combining diacritical marks (o que sobra depois de
// normalize("NFD")). Escrito com escape \u..., NAO com o range literal:
// caracteres combinantes crus na fonte sao frageis (git EOL, formatadores)
// e ja sairam como no-op no build de producao uma vez.
const COMBINING_MARKS = /[\u0300-\u036f]/g;

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .trim()
    .replace(/\s+/g, " ");
}

export function textsMatch(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b);
}

// Forma canonica de nome de base: sem acento, MAIUSCULAS, espacos
// colapsados, sem espacos nas pontas. Mantem alinhado com a normalizacao
// feita em massa na tabela `drivers` (ver migracao de bases).
export function canonBase(base: string | null | undefined): string | null {
  if (base == null) return null;
  const out = base
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  return out || null;
}

export function textContains(haystack: string, needle: string): boolean {
  const h = normalizeText(haystack);
  const n = normalizeText(needle);
  return h.includes(n) || n.includes(h);
}
