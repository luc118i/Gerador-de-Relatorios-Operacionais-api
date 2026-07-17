import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { buildSolicitacaoMudancaPdfHtml } from "./solicitacao-mudanca.template.js";
import { getLogoDataUri } from "./pdf.assets.js";
import { renderPdfFromHtml } from "./pdf.puppeteer.js";
import { uploadPrivatePdf, createSignedUrl } from "./pdf.storage.js";

const BUCKET = "reports";
const TTL = 60 * 60 * 24 * 7; // 7 dias

const LocalSchema = z.object({
  local: z.string().trim().min(1),
  tempoDeslocamento: z.string().trim().optional().nullable(),
  programado: z.string().trim().optional().nullable(),
  porData: z.record(z.string(), z.string().nullable().optional()).default({}),
  sugestao: z.string().trim().optional().nullable(),
  diffMin: z.number().nullable().optional(),
});

const BodySchema = z.object({
  itinerario: z.string().trim().min(1, "Itinerário obrigatório"),
  codigoViagem: z.string().trim().optional().nullable(),
  horarioViagem: z.string().trim().optional().nullable(),
  datas: z.array(z.string()).default([]),
  locais: z.array(LocalSchema).min(1, "Nenhum local informado"),
});

export async function getSolicitacaoMudancaPdfHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "INVALID_PAYLOAD", issues: parsed.error.issues } });
    }
    const b = parsed.data;

    const html = buildSolicitacaoMudancaPdfHtml({
      itinerario: b.itinerario,
      codigoViagem: b.codigoViagem ?? null,
      horarioViagem: b.horarioViagem ?? null,
      datas: b.datas,
      locais: b.locais,
      logoDataUri: getLogoDataUri(),
    });

    const buffer = await renderPdfFromHtml(html);

    const storagePath = `solicitacao-mudanca/${randomUUID()}.pdf`;
    await uploadPrivatePdf(BUCKET, storagePath, buffer);

    const url = await createSignedUrl(BUCKET, storagePath, TTL);
    return res.json({ url });
  } catch (err) {
    next(err);
  }
}
