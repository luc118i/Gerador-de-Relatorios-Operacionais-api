// resumo-analise.route.ts
// POST /reports/resumo-analise/drive — recebe os dados já prontos do
// "Resumo do dia" (tempo_permanencia.html, botão por região) e devolve
// o PDF direto no Drive do chamador, via token OAuth avulso (mesmo
// padrão de accessToken+folderId usado pelo Apps Script pros outros
// relatórios — ver getCredenciaisDriveRelatorios em BI_PC.js). Não lê
// nem escreve nada no banco deste projeto: os dados (excedências já
// analisadas) vivem só na planilha do BI PC's Não Autorizados.
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { buildResumoAnalisePdfHtml } from "./resumo-analise.template.js";
import { renderPdfFromHtml } from "./pdf.puppeteer.js";
import { getLogoDataUri } from "./pdf.assets.js";
import { uploadPdfToDriveWithToken } from "./pdf.drive.js";
import { AppError } from "./pdf.errors.js";

const ItemSchema = z.object({
  veiculo: z.string().trim().min(1),
  ponto: z.string().trim().min(1),
  cidade: z.string().trim().optional().nullable(),
  uf: z.string().trim().optional().nullable(),
  entrada: z.string().trim(),
  saida: z.string().trim(),
  excedenteMin: z.number().nullable().optional(),
  motivo: z.string().trim().optional().nullable(),
  motivoLabel: z.string().trim(),
  motivoCor: z.string().trim().optional().nullable(),
  detalhe: z.string().trim().optional().nullable(),
});

// Ponto de apoio — mesma base do ItemSchema, mais os campos que só fazem
// sentido pra esse tipo (permanência/permitido separados, já que o
// "permitido" vem do esquema operacional e pode não existir ainda quando
// o item foi só descartado por justificativa sem nunca vincular esquema;
// foraDoRoteiro sinaliza quando o local nem consta no roteiro — ver
// _aplicarEsquemaAoItem em tempo_permanencia.html).
const ItemApoioSchema = ItemSchema.extend({
  permanenciaMin: z.number().nullable().optional(),
  permitidoMin: z.number().nullable().optional(),
  foraDoRoteiro: z.boolean().optional(),
});

const BodySchema = z.object({
  regiao: z.string().trim().min(1),
  dataLabel: z.string().trim().optional().default(""),
  analisadoPor: z.string().trim().optional().nullable(),
  itens: z.array(ItemSchema).optional().default([]),
  itensApoio: z.array(ItemApoioSchema).optional().default([]),
  accessToken: z.string().trim().min(1, "accessToken é obrigatório"),
  folderId: z.string().trim().min(1, "folderId é obrigatório"),
}).refine((b) => b.itens.length > 0 || b.itensApoio.length > 0, {
  message: "Nenhuma excedência analisada pra resumir.",
});

function buildFileName(regiao: string, dataLabel: string): string {
  const safe = (s: string) => s.replace(/\//g, ".").replace(/[\\:*?"<>|]/g, "").trim();
  return `Resumo Analise - ${safe(regiao)} - ${safe(dataLabel)}.pdf`;
}

export async function sendResumoAnaliseToDriveHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "INVALID_PAYLOAD", issues: parsed.error.issues } });
    }
    const b = parsed.data;

    const html = buildResumoAnalisePdfHtml({
      regiao: b.regiao,
      dataLabel: b.dataLabel,
      analisadoPor: b.analisadoPor,
      itens: b.itens,
      itensApoio: b.itensApoio,
      logoDataUri: getLogoDataUri(),
    });

    const pdfBuffer = await renderPdfFromHtml(html);
    const fileName = buildFileName(b.regiao, b.dataLabel);

    const driveResult = await uploadPdfToDriveWithToken({
      pdfBuffer,
      fileName,
      folderId: b.folderId,
      accessToken: b.accessToken,
    });

    return res.status(200).json({
      data: { fileName: driveResult.fileName, webViewLink: driveResult.webViewLink },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }
    next(err);
  }
}
