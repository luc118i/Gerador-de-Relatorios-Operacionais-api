import puppeteer, { type Browser } from "puppeteer";
import { AppError } from "./pdf.errors.js";

let cachedBrowser: Browser | null = null;

export async function renderPdfFromHtml(html: string): Promise<Buffer> {
  // Data/hora atual no fuso horário de Brasília, formato dd/mm/aa HH:mm
  const brDateStr = (() => {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${g("day")}/${g("month")}/${g("year")}, ${g("hour")}:${g("minute")}`;
  })();

  const browserlessUrl = process.env.BROWSERLESS_URL;
  const htmlBytes = Buffer.byteLength(html, "utf8");

  // Usa Browserless apenas para HTMLs grandes (muitas evidências pesadas).
  // Abaixo do limite, o Chrome local é suficiente e preserva a cota do Browserless.
  const BROWSERLESS_THRESHOLD_BYTES =
    Number(process.env.BROWSERLESS_THRESHOLD_KB ?? 1024) * 1024; // padrão: 1 MB

  const isRemote = !!browserlessUrl && htmlBytes > BROWSERLESS_THRESHOLD_BYTES;

  console.log(
    `[Puppeteer] HTML ${(htmlBytes / 1024).toFixed(0)} KB — ` +
    `usando ${isRemote ? "Browserless" : "Chrome local"}` +
    (browserlessUrl && !isRemote ? ` (abaixo do limite de ${BROWSERLESS_THRESHOLD_BYTES / 1024} KB)` : ""),
  );

  // Conecta no Browserless ou lança Chrome local
  const browser = isRemote
    ? await connectBrowserless(browserlessUrl!)
    : await getLocalBrowser();

  try {
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,

      margin: {
        top: "22mm",
        right: "16mm",
        bottom: "25mm",
        left: "16mm",
      },

      headerTemplate: `
    <div style="
      width:100%;
      font-size:9px;
      padding:0 16mm;
      box-sizing:border-box;
      color:#666;
      font-family: Arial, Helvetica, sans-serif;
      display:flex;
      align-items:center;
    ">
      <div style="min-width:160px; text-align:left;">${brDateStr}</div>
      <div style="flex:1; text-align:center;"><span class="title"></span></div>
      <div style="min-width:160px;"></div>
    </div>
  `,

      footerTemplate: `
    <div style="
      width:100%;
      font-size:9px;
      padding:0 16mm;
      box-sizing:border-box;
      color:#666;
      font-family: Arial, Helvetica, sans-serif;
    ">
      <div style="border-top:1px solid #ddd; margin-bottom:6px;"></div>
      <div style="display:flex; align-items:center; width:100%;">
        <div style="min-width:120px;"></div>
        <div style="flex:1; text-align:center; line-height:1.3;">
          KANDANGO TRANSPORTE E TURISMO LTDA<br/>
          CNPJ: 03.233.439/0001-52
        </div>
        <div style="min-width:120px; text-align:right;">
          Página <span class="pageNumber"></span>
          de <span class="totalPages"></span>
        </div>
      </div>
    </div>
  `,
    });

    await page.close();
    return Buffer.from(pdf);
  } catch (e) {
    console.error("[Puppeteer] renderPdfFromHtml falhou:", e);
    const detail = e instanceof Error ? e.message : String(e);
    throw new AppError(
      500,
      `Falha ao renderizar PDF: ${detail}`,
      "PUPPETEER_RENDER_FAILED",
    );
  } finally {
    // Browserless: desconecta sem fechar o browser remoto
    // Local: mantém o browser em cache para reutilização
    if (isRemote) {
      try { browser.disconnect(); } catch { /* ignora */ }
    }
  }
}

// ── Browserless ──────────────────────────────────────────────────────────────

async function connectBrowserless(wsEndpoint: string): Promise<Browser> {
  console.log("[Puppeteer] conectando ao Browserless...");
  const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
  console.log("[Puppeteer] conectado ao Browserless.");
  return browser;
}

// ── Chrome local (desenvolvimento) ───────────────────────────────────────────

async function getLocalBrowser(): Promise<Browser> {
  if (cachedBrowser) {
    try {
      const probe = await cachedBrowser.newPage();
      await probe.close();
      return cachedBrowser;
    } catch {
      console.warn("[Puppeteer] browser em cache morto — reiniciando...");
      try { await cachedBrowser.close(); } catch { /* ignora */ }
      cachedBrowser = null;
    }
  }

  const isProd = process.env.NODE_ENV === "production";
  const args = [
    "--disable-dev-shm-usage",
    "--disable-setuid-sandbox",
    "--no-sandbox",
    "--no-zygote",
    "--single-process",
    "--font-render-hinting=none",
    "--disable-gpu",
  ];

  console.log("[Puppeteer] lançando browser local. isProd:", isProd);
  cachedBrowser = await puppeteer.launch({
    headless: true,
    args: isProd ? args : [],
  });
  console.log("[Puppeteer] browser local lançado.");

  cachedBrowser.on("disconnected", () => {
    console.warn("[Puppeteer] browser desconectado — limpando cache.");
    cachedBrowser = null;
  });

  return cachedBrowser;
}
