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

  const browser = await getBrowser();

  try {
    const page = await browser.newPage();

    // Se for carregar fontes remotas depois, habilite request interception/csp conforme necessário.
    await page.setContent(html, { waitUntil: "networkidle0" });

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

      // Cabeçalho: data BR à esquerda | título centrado | espaço espelho à direita
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

      // Rodapé: espaço espelho à esquerda | empresa centrada | página à direita
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
    throw new AppError(
      500,
      "Falha ao renderizar PDF (Puppeteer)",
      "PUPPETEER_RENDER_FAILED",
    );
  }
}

async function getBrowser(): Promise<Browser> {
  // Se há browser em cache, verifica se ainda está vivo
  if (cachedBrowser) {
    try {
      // newPage() lança se o processo já morreu
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
    "--font-render-hinting=none",
  ];

  cachedBrowser = await puppeteer.launch({
    headless: true,
    args: isProd ? args : [], // local Windows geralmente roda sem no-sandbox
  });

  // Remove o cache se o processo do browser encerrar inesperadamente
  cachedBrowser.on("disconnected", () => {
    console.warn("[Puppeteer] browser desconectado — limpando cache.");
    cachedBrowser = null;
  });

  return cachedBrowser;
}
