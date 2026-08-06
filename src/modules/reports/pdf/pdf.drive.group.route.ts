import type { Request, Response } from "express";
import { z } from "zod";
import { buildGroupOccurrencesPdf } from "./pdf.service.js";
import { downloadPrivateFileAsBuffer } from "./pdf.storage.js";
import {
  uploadPdfToDrive,
  uploadPdfToDriveWithToken,
  upsertPdfToDriveWithToken,
} from "./pdf.drive.js";
import { getOccurrenceForPdf, listDriversByOccurrence } from "./pdf.repo.js";
import { saveRizerData } from "../../occurrences/occurrences.repo.js";
import { buildFileName } from "./pdf.drive.route.js";
import { AppError } from "./pdf.errors.js";

const REPORTS_BUCKET = process.env.SUPABASE_REPORTS_BUCKET ?? "reports";

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);

const QuerySchema = z.object({
  ids: z.preprocess(
    first,
    z.string().min(1, "ids é obrigatório (lista separada por vírgula)"),
  ),
});

// Envia ao Drive um único PDF cobrindo várias ocorrências de
// EXCESSO_PERMANENCIA (mesmo veículo/viagem, um ponto por ocorrência) —
// equivalente em grupo do sendOccurrenceToDriveHandler (pdf.drive.route.ts).
// Usado pelo "Gerar Relatório" em grupo de tempo_permanencia.html.
export async function sendGroupOccurrencesToDriveHandler(
  req: Request,
  res: Response,
) {
  try {
    const q = QuerySchema.parse(req.query);
    const occurrenceIds = q.ids.split(",").map((s) => s.trim()).filter(Boolean);
    if (occurrenceIds.length === 0) {
      throw new AppError(400, "Informe ao menos um occurrenceId em ids", "EMPTY_GROUP");
    }

    // Token e pasta enviados pelo frontend (fluxo OAuth do usuário) — opcional,
    // igual ao endpoint individual. Sem isso, usa a service account do backend.
    const accessToken: string | undefined = req.body?.accessToken;
    const folderIdFromBody: string | undefined = req.body?.folderId;
    const fileNameOverride: string | undefined = req.body?.fileName;
    const force: boolean = !!req.body?.force;

    if (accessToken && !folderIdFromBody) {
      throw new AppError(400, "folderId é obrigatório quando accessToken é enviado", "BAD_FOLDER_ID");
    }

    // 1. Garante que o PDF do grupo existe no Supabase (usa cache se disponível)
    const pdfResult = await buildGroupOccurrencesPdf({
      occurrenceIds,
      force: false,
      maxPhotos: 20,
    });

    // 2. Baixa o buffer do PDF do Supabase Storage
    const pdfBuffer = await downloadPrivateFileAsBuffer(
      REPORTS_BUCKET,
      pdfResult.pdfStoragePath,
    );

    // 3. Nome do arquivo — usa a 1ª ocorrência do grupo como referência
    //    (mesmo motorista/veículo/data de todas as outras) quando o
    //    front-end não mandar um nome pronto.
    const fileName =
      fileNameOverride ||
      (await (async () => {
        const firstId = occurrenceIds[0]!;
        const [occurrence, drivers] = await Promise.all([
          getOccurrenceForPdf(firstId),
          listDriversByOccurrence(firstId),
        ]);
        return buildFileName(occurrence, drivers);
      })());

    // 4. Faz upload — upsert (se force=true) ou create; usa token do usuário se disponível
    const driveResult = accessToken && folderIdFromBody
      ? force
        ? await upsertPdfToDriveWithToken({ pdfBuffer, fileName, folderId: folderIdFromBody, accessToken })
        : await uploadPdfToDriveWithToken({ pdfBuffer, fileName, folderId: folderIdFromBody, accessToken })
      : await uploadPdfToDrive({ pdfBuffer, fileName });

    // 5. Persiste o nome do arquivo e o link do Drive em TODAS as
    //    ocorrências do grupo — o mesmo PDF cobre todas, então todas
    //    apontam pro mesmo arquivo.
    await Promise.all(
      occurrenceIds.map((id) =>
        saveRizerData(id, {
          driveFileNome: driveResult.fileName,
          driveWebViewLink: driveResult.webViewLink,
        }),
      ),
    );

    return res.status(200).json({
      data: {
        occurrenceIds,
        drive: {
          fileId: driveResult.fileId,
          fileName: driveResult.fileName,
          webViewLink: driveResult.webViewLink,
        },
      },
    });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res.status(400).json({
        error: { message: "Parâmetros inválidos", details: err.errors },
      });
    }
    if (err instanceof AppError) {
      return res
        .status(err.status)
        .json({ error: { code: err.code, message: err.message } });
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[sendGroupOccurrencesToDriveHandler] erro:", err);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: detail },
    });
  }
}
