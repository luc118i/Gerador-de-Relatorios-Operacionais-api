import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getTempoPermanenciaMap } from "../../telemetry/repositories/tempo-permanencia.repo.js";
import { buildExcessoParadaReportHtml, extractExcessos } from "./excesso-parada.template.js";
import { getLogoDataUri } from "./pdf.assets.js";
import { renderPdfFromHtml } from "./pdf.puppeteer.js";
import { uploadPrivatePdf, createSignedUrl } from "./pdf.storage.js";

const BUCKET = "reports";
const TTL = 60 * 60 * 24 * 7; // 7 dias

const BodySchema = z.object({
  dataEvento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data do evento inválida (YYYY-MM-DD)"),
  dataViagem: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data da viagem inválida (YYYY-MM-DD)"),
  horarioInicial: z.string().regex(/^\d{2}:\d{2}$/, "Horário inicial inválido (HH:MM)"),
  horarioFinal: z.string().regex(/^\d{2}:\d{2}$/, "Horário final inválido (HH:MM)"),
  prefixo: z.string().trim().min(1, "Prefixo obrigatório"),
  localParada: z.string().trim().min(1, "Local da parada obrigatório"),
  motorista: z.string().trim().optional(),
});

export async function getExcessoParadaManualPdfHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "INVALID_PAYLOAD", issues: parsed.error.issues } });
    }
    const b = parsed.data;

    const tempoMap = await getTempoPermanenciaMap();

    const entrada = `${b.dataEvento} ${b.horarioInicial}:00`;
    let saida = `${b.dataEvento} ${b.horarioFinal}:00`;

    // Parada que cruza a meia-noite: saída no dia seguinte
    if (b.horarioFinal <= b.horarioInicial) {
      const next = new Date(`${b.dataEvento}T00:00:00`);
      next.setDate(next.getDate() + 1);
      const yyyy = next.getFullYear();
      const mm = String(next.getMonth() + 1).padStart(2, "0");
      const dd = String(next.getDate()).padStart(2, "0");
      saida = `${yyyy}-${mm}-${dd} ${b.horarioFinal}:00`;
    }

    const [hi, mi] = b.horarioInicial.split(":").map(Number) as [number, number];
    const [hf, mf] = b.horarioFinal.split(":").map(Number) as [number, number];
    let paradaS = (hf * 60 + mf - (hi * 60 + mi)) * 60;
    if (paradaS <= 0) paradaS += 24 * 3600;

    const excessos = extractExcessos(
      [{ seq: 1, ponto: b.localParada, entrada, saida, parada_s: paradaS }],
      tempoMap,
    );

    if (excessos.length === 0) {
      return res.status(422).json({
        error: {
          code: "SEM_EXCESSO",
          message: "A permanência informada não excede o tempo permitido para o local selecionado.",
        },
      });
    }

    const html = buildExcessoParadaReportHtml({
      prefixo: b.prefixo,
      dataViagem: b.dataViagem,
      dataEvento: b.dataEvento,
      motorista: b.motorista ?? null,
      excessos,
      logoDataUri: getLogoDataUri(),
    });

    const buffer = await renderPdfFromHtml(html);

    const storagePath = `excesso-parada/${randomUUID()}.pdf`;
    await uploadPrivatePdf(BUCKET, storagePath, buffer);

    const url = await createSignedUrl(BUCKET, storagePath, TTL);
    return res.json({ url, excessos: excessos.length });
  } catch (err) {
    next(err);
  }
}
