import HTMLtoDOCX from "@turbodocx/html-to-docx";
import juice from "juice";
import * as cheerio from "cheerio";
import { AppError } from "./pdf.errors.js";

/**
 * Prepara o HTML do PDF para máxima fidelidade no DOCX. Roda SOMENTE no caminho
 * do DOCX — o HTML/PDF original não é alterado.
 *
 * Duas etapas:
 *  1. juice(): reescreve as regras de blocos <style> (classes, .section-hd,
 *     cabeçalho, rodapé, tabelas) como estilos INLINE, que é o que o
 *     html-to-docx entende.
 *  2. shadeBlocks(): o html-to-docx só aplica cor de fundo (sombreamento) em
 *     células de tabela, não em <div>. Então convertemos cada bloco com
 *     background inline (faixa do cabeçalho, barras de seção, rodapé, caixas do
 *     diagnóstico) numa tabela de 1 célula, para o fundo aparecer no Word.
 */
function prepareHtmlForDocx(html: string): string {
  const juiced = juice(html);
  const $ = cheerio.load(juiced);

  $("div, header, footer, section").each((_i, el) => {
    const $el = $(el);
    if (!$el.parent().length) return; // já substituído por um ancestral

    const style = $el.attr("style") || "";
    const m = style.match(/background(?:-color)?\s*:\s*([^;]+)/i);
    if (!m) return;

    const bg = (m[1] ?? "").trim().toLowerCase();
    if (!bg) return;
    // Ignora fundos "vazios" (branco/transparente) — não precisam virar tabela.
    if (/^(transparent|none|white|#fff|#ffffff|rgba?\(255,\s*255,\s*255)/.test(bg)) return;

    $el.replaceWith(
      '<table style="width:100%;border-collapse:collapse;margin:0;">' +
        "<tbody><tr>" +
        '<td style="' + style + '">' + ($el.html() ?? "") + "</td>" +
        "</tr></tbody></table>",
    );
  });

  return $.html();
}

/**
 * Converte o mesmo HTML usado no PDF em um documento Word (.docx), aplicando
 * o máximo de estilo possível (ver prepareHtmlForDocx).
 *
 * Teto de fidelidade: o Word não tem flexbox/grid/gradiente/sombra, então
 * layouts baseados em flex são simplificados. Cores, fundos, bordas, fontes e
 * tabelas são preservados.
 */
export async function renderDocxFromHtml(html: string): Promise<Buffer> {
  try {
    const prepared = prepareHtmlForDocx(html);

    const out = await HTMLtoDOCX(prepared, null, {
      table: { row: { cantSplit: true } },
      footer: false,
      pageNumber: false,
      // Margens em twips (1 cm ≈ 567 twips); ~1,25 cm nas laterais.
      margins: { top: 720, right: 709, bottom: 720, left: 709 },
    });

    if (Buffer.isBuffer(out)) return out;
    if (out instanceof ArrayBuffer) return Buffer.from(new Uint8Array(out));
    // Blob (ambiente browser-like) → arrayBuffer
    if (out && typeof (out as Blob).arrayBuffer === "function") {
      const ab = await (out as Blob).arrayBuffer();
      return Buffer.from(new Uint8Array(ab));
    }
    // Uint8Array ou similar
    return Buffer.from(out as unknown as Uint8Array);
  } catch (e: any) {
    console.error("[docx] renderDocxFromHtml falhou:", e);
    throw new AppError(
      500,
      `Falha ao renderizar DOCX: ${e?.message ?? e}`,
      "DOCX_RENDER_FAILED",
    );
  }
}
