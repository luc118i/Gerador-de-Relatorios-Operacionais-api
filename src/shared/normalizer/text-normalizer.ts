// Remocao de acento SEM depender de String.prototype.normalize("NFD"):
// o runtime de producao (Koyeb) tem ICU reduzido e normalize() virou no-op,
// deixando "brasilia" acentuada passar. Mapa explicito cobre pt-BR + comuns.
const DIACRITICS: Record<string, string> = {
  á: "a", à: "a", ã: "a", â: "a", ä: "a", å: "a",
  é: "e", è: "e", ê: "e", ë: "e",
  í: "i", ì: "i", î: "i", ï: "i",
  ó: "o", ò: "o", õ: "o", ô: "o", ö: "o",
  ú: "u", ù: "u", û: "u", ü: "u",
  ç: "c", ñ: "n", ý: "y", ÿ: "y",
};

/** Tira acento de letras latinas comuns (case-insensitive no resultado). */
export function stripDiacritics(text: string): string {
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const mapped = DIACRITICS[lower];
    if (mapped === undefined) { out += ch; continue; }
    out += ch === lower ? mapped : mapped.toUpperCase();
  }
  return out;
}

export function normalizeText(text: string): string {
  return stripDiacritics(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function textsMatch(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b);
}

// Forma canonica de nome de base: sem acento, MAIUSCULAS, espacos
// colapsados, sem espacos nas pontas. Alinha com a normalizacao feita em
// massa na tabela `drivers` (ver migracao de bases).
export function canonBase(base: string | null | undefined): string | null {
  if (base == null) return null;
  const out = stripDiacritics(base)
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
