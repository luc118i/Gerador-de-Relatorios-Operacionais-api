export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

export function textsMatch(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b);
}

// Forma canônica de nome de base: sem acento, MAIÚSCULAS, espaços
// colapsados, sem espaços nas pontas. Mantém alinhado com a normalização
// feita em massa na tabela `drivers` (ver migração de bases).
export function canonBase(base: string | null | undefined): string | null {
  if (base == null) return null;
  const out = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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
