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
    console.warn("[AppsScript] URL ou TOKEN não configurados, pulando.");
    return;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...payload }),
    });
  } catch (err) {
    console.error("[AppsScript] Erro ao notificar:", err);
  }
}
