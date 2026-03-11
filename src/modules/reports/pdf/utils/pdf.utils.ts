export function escapeHtml(s: string) {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderTemplate(
  template: string,
  variables: Record<string, string | undefined>,
) {
  if (!template) return "";

  return (
    template
      // Aceita tanto {{variavel}} quanto {variavel}
      .replace(/{{?(.*?)}}?/g, (_, key) => {
        const value = variables[key.trim()];
        return escapeHtml(value ?? "—");
      })
      .replace(/\n/g, "<br/>")
  );
}
