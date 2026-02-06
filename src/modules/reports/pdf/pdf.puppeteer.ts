import puppeteer, { type Browser } from "puppeteer";
import { AppError } from "./pdf.errors";

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
      preferCSSPageSize: true,
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
