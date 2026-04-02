// src/core/infra/appsScript.service.ts

export async function notifyAppsScript(payload: {
  localId: string;
  localNome: string;
  carro: string;
  motoristaId: string;
  motoristaNome: string;
  base: string;
  dataRelatorio: string;
}) {
  const url = process.env.APPS_SCRIPT_URL;
  const token = process.env.APPS_SCRIPT_TOKEN;

  if (!url || !token) {
    console.warn("[AppsScript] URL ou TOKEN não configurados, pulando notificação.");
    return;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...payload }),
    });

    // Apps Script sempre retorna HTTP 200 — precisamos ler o body para detectar erros
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;

    if (!res.ok) {
      console.error(
        `[AppsScript] HTTP ${res.status} ao notificar. Payload:`,
        payload,
        "Resposta:",
        body,
      );
      return;
    }

    if (body?.error) {
      console.error(
        "[AppsScript] Apps Script retornou erro:",
        body.error,
        "| Payload enviado:",
        payload,
      );
      return;
    }

    console.log(
      `[AppsScript] Histórico atualizado — motorista: ${payload.motoristaNome}, local: ${payload.localNome}`,
    );
  } catch (err) {
    console.error("[AppsScript] Falha de rede ao notificar:", err, "| Payload:", payload);
  }
}
