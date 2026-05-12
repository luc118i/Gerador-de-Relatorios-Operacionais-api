import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "./pdf.errors.js";
import { getOccurrenceForPdf, listDriversByOccurrence } from "./pdf.repo.js";
import { getSuspensaoLogoDataUri } from "./pdf.assets.js";
import { buildSuspensaoPdfHtml } from "./suspensao.template.js";
import { renderPdfFromHtml } from "./pdf.puppeteer.js";
import { gerarParagrafoSuspensao } from "../../ai/ai.service.js";
import { findLocalById } from "../../locais/locais.repo.js";
import type { PdfOccurrence, PdfDriver } from "./pdf.types.js";
import { uploadPrivatePdf, createSignedUrl } from "./pdf.storage.js";
import { upsertSuspensao, getSuspensaoByOccurrenceId } from "./suspensao.repo.js";

const BUCKET = process.env.SUPABASE_REPORTS_BUCKET ?? "reports";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 dias

const BodySchema = z.object({
  dataInicioSuspensao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida, use YYYY-MM-DD"),
  quantidadeDias: z
    .number()
    .int()
    .min(1, "Mínimo 1 dia")
    .max(30, "Máximo 30 dias"),
});

export async function getSuspensaoPdfHandler(req: Request, res: Response) {
  try {
    const occurrenceId = req.params.id;
    if (typeof occurrenceId !== "string") {
      throw new AppError(400, "Parâmetro :id inválido", "BAD_OCCURRENCE_ID");
    }

    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: "INVALID_PAYLOAD", issues: parsed.error.issues },
      });
    }
    const { dataInicioSuspensao, quantidadeDias } = parsed.data;

    const [occurrence, drivers] = await Promise.all([
      getOccurrenceForPdf(occurrenceId),
      listDriversByOccurrence(occurrenceId),
    ]);

    const driver1 = drivers[0];
    const motoristaNome = driver1?.name ?? "—";
    const matricula = driver1?.code ?? "";
    const baseCode = driver1?.baseCode ?? "";

    const partes: string[] = [];
    if (matricula) partes.push(matricula);
    partes.push(motoristaNome);
    if (baseCode) partes.push(baseCode);
    const colaborador = partes.join(" – ");

    const tipoOcorrencia = occurrence.typeCode === "GENERICO"
      ? (occurrence.reportTitle ?? occurrence.typeTitle ?? "Ocorrência")
      : (occurrence.typeTitle ?? occurrence.typeCode ?? "Ocorrência");
    const fmtDataOcorrencia = fmtDateBr(occurrence.eventDate);

    const localNome = await resolveLocalNome(occurrence.place ?? "");

    const primeiroParagrafo = await gerarParagrafoSuspensao({
      tipoOcorrencia,
      prefixo: occurrence.vehicleNumber ?? "—",
      linha: occurrence.lineLabel ?? "",
      local: localNome,
      dataOcorrencia: fmtDataOcorrencia,
      motoristaNome,
      relatoHtml: occurrence.relatoHtml ?? null,
    });

    const html = buildSuspensaoPdfHtml({
      colaborador,
      dataOcorrencia: occurrence.eventDate,
      assunto: tipoOcorrencia,
      dataInicioSuspensao,
      quantidadeDias,
      primeiroParagrafo,
      logoDataUri: getSuspensaoLogoDataUri(),
    });

    const pdfBuffer = await renderPdfFromHtml(html);

    const storagePath = `suspensoes/${occurrenceId}/suspensao.pdf`;
    await uploadPrivatePdf(BUCKET, storagePath, pdfBuffer);
    await upsertSuspensao(occurrenceId, dataInicioSuspensao, quantidadeDias, storagePath);

    const signedUrl = await createSignedUrl(BUCKET, storagePath, SIGNED_URL_TTL);
    const filename = buildSuspensaoFileName(occurrence, drivers, tipoOcorrencia);

    return res.json({ signedUrl, dataInicio: dataInicioSuspensao, dias: quantidadeDias, filename });
  } catch (err: any) {
    if (err instanceof AppError) {
      return res.status(err.status).json({
        error: { code: err.code, message: err.message },
      });
    }
    console.error("[getSuspensaoPdfHandler] erro:", err);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Erro ao gerar PDF de suspensão" },
    });
  }
}

export async function getSuspensaoInfoHandler(req: Request, res: Response) {
  try {
    const occurrenceId = req.params.id;
    if (typeof occurrenceId !== "string") {
      throw new AppError(400, "Parâmetro :id inválido", "BAD_OCCURRENCE_ID");
    }

    const record = await getSuspensaoByOccurrenceId(occurrenceId);
    if (!record) {
      return res.json({ suspensao: null });
    }

    const signedUrl = await createSignedUrl(BUCKET, record.pdfPath, SIGNED_URL_TTL);
    return res.json({
      suspensao: { dataInicio: record.dataInicio, dias: record.dias, signedUrl },
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return res.status(err.status).json({
        error: { code: err.code, message: err.message },
      });
    }
    console.error("[getSuspensaoInfoHandler] erro:", err);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Erro ao buscar suspensão" },
    });
  }
}

function fmtDateBr(iso: string): string {
  const [y, m, d] = (iso ?? "").split("-");
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function buildSuspensaoFileName(
  o: PdfOccurrence,
  drivers: PdfDriver[],
  tipoOcorrencia: string,
): string {
  const d1 = drivers[0];
  const matricula = d1?.code ?? "";
  const nome = d1?.name?.split(" ").slice(0, 2).join(" ") ?? "";
  const base = d1?.baseCode ?? "";
  const date = (o.tripDate ?? o.eventDate ?? "").replace(/-/g, ".");
  return [matricula, nome, base, tipoOcorrencia, date, "SUSPENSAO"]
    .filter(Boolean)
    .join(" - ") + ".pdf";
}

async function resolveLocalNome(place: string): Promise<string> {
  if (!place) return "";
  const numId = Number(place);
  if (Number.isInteger(numId) && numId > 0) {
    const nome = await findLocalById(numId);
    return nome ?? place;
  }
  return place;
}
