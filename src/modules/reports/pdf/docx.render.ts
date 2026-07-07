import HTMLtoDOCX from "@turbodocx/html-to-docx";
import { AppError } from "./pdf.errors.js";

/**
 * Converte o mesmo HTML usado no PDF em um documento Word (.docx).
 *
 * Observação de fidelidade: a biblioteca honra bem estilos INLINE, tabelas e
 * imagens (data URIs), mas tem suporte limitado a regras em blocos <style>.
 * O corpo do relatório operacional e o bloco de Diagnóstico são inline e
 * convertem com boa fidelidade; o "letterhead" (cabeçalho/rodapé via classes)
 * pode sair simplificado.
 */
export async function renderDocxFromHtml(html: string): Promise<Buffer> {
  try {
    const out = await HTMLtoDOCX(html, null, {
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
