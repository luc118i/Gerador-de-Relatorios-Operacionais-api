import puppeteer, { type Browser } from "puppeteer";
import { AppError } from "./pdf.errors.js";

let cachedBrowser: Browser | null = null;

/**
 * Serializa os renders no browser local para evitar que duas requisições
 * simultâneas compartilhem o mesmo browser e causem race conditions.
 */
let renderQueue: Promise<unknown> = Promise.resolve();

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

  const BROWSERLESS_THRESHOLD_BYTES =
    Number(process.env.BROWSERLESS_THRESHOLD_KB ?? 1024) * 1024;

  const isRemote = !!browserlessUrl && htmlBytes > BROWSERLESS_THRESHOLD_BYTES;

  console.log(
    `[Puppeteer] HTML ${(htmlBytes / 1024).toFixed(0)} KB — ` +
    `usando ${isRemote ? "Browserless" : "Chrome local"}` +
    (browserlessUrl && !isRemote ? ` (abaixo do limite de ${BROWSERLESS_THRESHOLD_BYTES / 1024} KB)` : ""),
  );

  // Browserless: cada render usa sua própria conexão isolada
  if (isRemote) {
    const browser = await connectBrowserless(browserlessUrl!);
    try {
      return await renderPage(browser, brDateStr, html);
    } finally {
      try { browser.disconnect(); } catch { /* ignora */ }
    }
  }

  // Chrome local: serializa os renders para evitar instabilidade com uso concorrente
  const job = renderQueue.then(() => renderWithLocalBrowser(brDateStr, html));
  renderQueue = job.catch(() => {}); // não deixa a cadeia quebrar em caso de erro
  return job;
}

// ── Render com Chrome local (com retry automático) ───────────────────────────

async function renderWithLocalBrowser(brDateStr: string, html: string): Promise<Buffer> {
  const browser = await getLocalBrowser();
  try {
    return await renderPage(browser, brDateStr, html);
  } catch (e) {
    // Se o browser caiu no meio do render, tenta UMA vez com browser fresco
    if (isTargetClosedError(e)) {
      console.warn("[Puppeteer] browser caiu durante o render — tentando novamente com browser fresco...");
      cachedBrowser = null; // garante que getLocalBrowser vai lançar um novo
      const fresh = await getLocalBrowser();
      return await renderPage(fresh, brDateStr, html);
    }
    throw e;
  }
}

// ── Renderiza uma página e retorna o PDF ─────────────────────────────────────

async function renderPage(browser: Browser, brDateStr: string, html: string): Promise<Buffer> {
  const page = await browser.newPage();
  try {
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

    return Buffer.from(pdf);
  } catch (e) {
    console.error("[Puppeteer] renderPdfFromHtml falhou:", e);
    const detail = e instanceof Error ? e.message : String(e);
    throw new AppError(500, `Falha ao renderizar PDF: ${detail}`, "PUPPETEER_RENDER_FAILED");
  } finally {
    await page.close().catch(() => {});
  }
}

// ── Browserless ───────────────────────────────────────────────────────────────

async function connectBrowserless(wsEndpoint: string): Promise<Browser> {
  console.log("[Puppeteer] conectando ao Browserless...");
  const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
  console.log("[Puppeteer] conectado ao Browserless.");
  return browser;
}

// ── Chrome local (com cache) ──────────────────────────────────────────────────

async function getLocalBrowser(): Promise<Browser> {
  // Verifica se o browser em cache ainda está conectado
  if (cachedBrowser?.isConnected()) {
    return cachedBrowser;
  }

  // Browser morto — descarta o cache
  if (cachedBrowser) {
    try { await cachedBrowser.close(); } catch { /* ignora */ }
    cachedBrowser = null;
  }

  const isProd = process.env.NODE_ENV === "production";
  const args = [
    "--disable-dev-shm-usage",
    "--disable-setuid-sandbox",
    "--no-sandbox",
    "--no-zygote",
    // NOTA: "--single-process" foi removido — causava crashes em produção
    // quando múltiplos renders aconteciam em sequência
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

// ── Utils ─────────────────────────────────────────────────────────────────────

function isTargetClosedError(e: unknown): boolean {
  return (
    e instanceof Error &&
    (e.message.includes("Target closed") || e.message.includes("Protocol error"))
  );
}
