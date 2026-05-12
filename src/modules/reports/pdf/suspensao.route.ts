import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "./pdf.errors.js";
import { getOccurrenceForPdf, listDriversByOccurrence } from "./pdf.repo.js";
import { getSuspensaoLogoDataUri } from "./pdf.assets.js";
import { buildSuspensaoPdfHtml } from "./suspensao.template.js";
import { renderSuspensaoPdfFromHtml } from "./pdf.puppeteer.js";
import { gerarParagrafoSuspensao } from "../../ai/ai.service.js";
import { findLocalById } from "../../locais/locais.repo.js";

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

    const tipoOcorrencia = occurrence.typeTitle ?? occurrence.typeCode ?? "Ocorrência";
    const fmtDataOcorrencia = fmtDateBr(occurrence.eventDate);

    // Se place for um ID numérico, resolve o nome no cadastro de locais
    const localNome = await resolveLocalNome(occurrence.place ?? "");

    const primeiroParagrafo = await gerarParagrafoSuspensao({
      tipoOcorrencia,
      prefixo: occurrence.vehicleNumber ?? "—",
      linha: occurrence.lineLabel ?? "",
      local: localNome,
      dataOcorrencia: fmtDataOcorrencia,
      motoristaNome,
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

    const pdfBuffer = await renderSuspensaoPdfFromHtml(html);

    const filename = `suspensao-${matricula || motoristaNome.split(" ")[0]}-${dataInicioSuspensao}.pdf`
      .replace(/[^a-zA-Z0-9\-_.]/g, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
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

function fmtDateBr(iso: string): string {
  const [y, m, d] = (iso ?? "").split("-");
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
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
