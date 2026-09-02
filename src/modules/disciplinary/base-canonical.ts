// Normalização de leitura para nomes de base "sujos" no dashboard de motoristas.
//
// O campo `drivers.base` é texto livre e histórico: convivem grafias como
// "Montes Claros", "MONTES CLAROS", "MONTES CLAROS - MG". Sem normalizar, o
// gráfico "Ocorrências por base" e o ranking mostram a mesma base várias vezes.
//
// Isto NÃO altera os dados — só agrupa/exibe de forma consistente. Cadastros
// novos e edições já saem no padrão (o app força escolher a base pelo cadastro
// oficial); esta função cobre o legado enquanto ele existir.

/** Chave de agrupamento: maiúsculas, sem acento, sem sufixo " - UF", espaços colapsados. */
export function baseGroupKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s*-\s*[A-Z]{2}\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

const MINOR_WORDS = new Set(["DE", "DA", "DO", "DAS", "DOS", "E"]);

/** Title Case simples (preserva conectores em minúsculo) para a chave normalizada. */
function titleCase(key: string): string {
  return key
    .toLowerCase()
    .split(" ")
    .map((w, i) =>
      i > 0 && MINOR_WORDS.has(w.toUpperCase())
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

/**
 * Constrói o de-para `chave normalizada -> visibilidade oficial` a partir do
 * cadastro de bases (base_responsaveis).
 */
export function buildRegistryLabelMap(
  bases: Array<{ visibilidade: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const b of bases) {
    const v = (b.visibilidade ?? "").trim();
    if (v) map.set(baseGroupKey(v), v);
  }
  return map;
}

/**
 * Rótulo canônico de exibição para uma base:
 * 1. `visibilidade` do cadastro oficial quando a chave bate;
 * 2. senão, Title Case da chave normalizada (junta pelo menos as variações de caixa).
 */
export function canonicalBaseLabel(
  raw: string | null | undefined,
  registryByKey: Map<string, string>,
): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const key = baseGroupKey(trimmed);
  if (!key) return null;
  return registryByKey.get(key) ?? titleCase(key);
}
