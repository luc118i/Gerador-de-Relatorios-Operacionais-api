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

export function textContains(haystack: string, needle: string): boolean {
  const h = normalizeText(haystack);
  const n = normalizeText(needle);
  return h.includes(n) || n.includes(h);
}
