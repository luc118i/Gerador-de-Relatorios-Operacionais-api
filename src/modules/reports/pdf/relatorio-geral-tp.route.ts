// relatorio-geral-tp.route.ts
// POST /reports/relatorio-geral-tp/drive — recebe o BI já agregado do
// dashboard de "Tempo de Permanência" (tempo_permanencia.html, botão
// "Relatório Geral" no cabeçalho do Dashboard) e devolve o PDF direto no
// Drive do chamador, via token OAuth avulso (mesmo padrão accessToken+
// folderId dos outros relatórios — ver resumo-analise.route.ts). Não lê
// nem escreve nada no banco deste projeto: os dados (histórico de
// excessos) vivem só na planilha do BI PC's Não Autorizados.
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { buildRelatorioGeralTpPdfHtml } from "./relatorio-geral-tp.template.js";
import { renderPdfFromHtml } from "./pdf.puppeteer.js";
import { getLogoDataUri } from "./pdf.assets.js";
import { uploadPdfToDriveWithToken } from "./pdf.drive.js";
import { AppError } from "./pdf.errors.js";

const ContagemSchema = z.object({
  chave: z.string().trim().min(1),
  count: z.number(),
});

const BodySchema = z.object({
  periodoIni: z.string().trim().min(1),
  periodoFim: z.string().trim().min(1),
  geradoPor: z.string().trim().optional().nullable(),
  kpis: z.object({
    totalRelatorios: z.number(),
    totalVeiculos: z.number(),
    pontoTop: z.object({ nome: z.string(), count: z.number() }).nullable(),
    motoristaTop: z.object({ nome: z.string(), count: z.number() }).nullable(),
  }),
  porDia: z.array(ContagemSchema),
  porRegiao: z.array(ContagemSchema),
  topPontos: z.array(ContagemSchema),
  rankLinhas: z.array(ContagemSchema),
  rankMotoristas: z.array(ContagemSchema),
  motivosAnalise: z.array(z.object({
    motivo: z.string(),
    label: z.string(),
    cor: z.string(),
    count: z.number(),
  })),
  accessToken: z.string().trim().min(1, "accessToken é obrigatório"),
  folderId: z.string().trim().min(1, "folderId é obrigatório"),
});

function buildFileName(periodoIni: string, periodoFim: string): string {
  const safe = (s: string) => s.replace(/\//g, ".").replace(/[\\:*?"<>|]/g, "").trim();
  return `Relatorio Geral - Tempo de Permanencia - ${safe(periodoIni)} a ${safe(periodoFim)}.pdf`;
}

export async function sendRelatorioGeralTpToDriveHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "INVALID_PAYLOAD", issues: parsed.error.issues } });
    }
    const b = parsed.data;

    const html = buildRelatorioGeralTpPdfHtml({
      periodoIni: b.periodoIni,
      periodoFim: b.periodoFim,
      geradoPor: b.geradoPor,
      kpis: b.kpis,
      porDia: b.porDia,
      porRegiao: b.porRegiao,
      topPontos: b.topPontos,
      rankLinhas: b.rankLinhas,
      rankMotoristas: b.rankMotoristas,
      motivosAnalise: b.motivosAnalise,
      logoDataUri: getLogoDataUri(),
    });

    const pdfBuffer = await renderPdfFromHtml(html);
    const fileName = buildFileName(b.periodoIni, b.periodoFim);

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
