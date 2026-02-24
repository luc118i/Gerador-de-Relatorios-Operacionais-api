import puppeteer, { type Browser } from "puppeteer";
import { AppError } from "./pdf.errors.js";

let cachedBrowser: Browser | null = null;

export async function renderPdfFromHtml(html: string): Promise<Buffer> {
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

      footerTemplate: `
    <div style="
      width:100%;
      font-size:9px;
      padding:0 16mm;
      box-sizing:border-box;
      color:#666;
      font-family: Arial, Helvetica, sans-serif;
    ">
      <div style="
        border-top:1px solid #ddd;
        margin-bottom:6px;
      "></div>

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:flex-end;
        width:100%;
      ">
        <div style="
          flex:1;
          text-align:center;
          line-height:1.3;
        ">
          KANDANGO TRANSPORTE E TURISMO LTDA<br/>
          CNPJ: 03.233.439/0001-52
        </div>

        <div style="
          min-width:120px;
          text-align:right;
        ">
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
  if (cachedBrowser) return cachedBrowser;

  const isProd = process.env.NODE_ENV === "production";
  const args = [
    "--disable-dev-shm-usage",
    "--disable-setuid-sandbox",
    "--no-sandbox", // comum em deploy
    "--no-zygote",
    "--font-render-hinting=none",
  ];

  cachedBrowser = await puppeteer.launch({
    headless: true,
    args: isProd ? args : [], // local Windows geralmente roda sem no-sandbox
  });

  return cachedBrowser;
}
