import type { Request, Response } from "express";
import { buildOccurrencePdf } from "./pdf.service.js";
import { downloadPrivateFileAsBuffer } from "./pdf.storage.js";
import { uploadPdfToDrive, uploadPdfToDriveWithToken, upsertPdfToDriveWithToken } from "./pdf.drive.js";
import { getOccurrenceForPdf, listDriversByOccurrence } from "./pdf.repo.js";
import { AppError } from "./pdf.errors.js";
import type { PdfOccurrence, PdfDriver } from "./pdf.types.js";

const REPORTS_BUCKET = process.env.SUPABASE_REPORTS_BUCKET ?? "reports";

// ── Helpers de nome de arquivo ──────────────────────────────────────────────

const STOPWORDS = new Set([
  "DE","DA","DO","DAS","DOS","E","EM","POR","COM","A","O",
  "AO","NO","NA","NOS","NAS","OU","SE","QUE","UM","UMA",
]);

function abbreviateTitle(title: string): string {
  const t = (title ?? "").toUpperCase().trim();
  if (!t) return "OCOR";

  if (t.includes("EXCESSO") && t.includes("VELOCIDADE")) return "EXC_VEL";
  if (t.includes("PARADA FORA") || t.includes("PARADA_FORA")) return "PARADA_IRREG";
  if (t.includes("DESCUMPRIMENTO") && t.includes("EMBARQUE")) return "DESC_EMBARQUE";
  if (t.includes("DESCUMPRIMENTO")) return "DESC_OP";
  if (t.includes("AVARIA")) return "AVARIA";

  const words = t
    .replace(/[/\-–|]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/[^A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÜÇ]/g, ""))
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));

  if (words.length === 0) return t.replace(/\s+/g, "_").substring(0, 8);
  if (words.length === 1) return (words[0] as string).substring(0, 8);
  return `${(words[0] as string).substring(0, 5)}_${(words[1] as string).substring(0, 5)}`;
}

function buildFileName(o: PdfOccurrence, drivers: PdfDriver[]): string {
  const date = (o.tripDate ?? o.eventDate ?? "").replace(/-/g, ".");
  const vehicle = o.vehicleNumber ?? "";
  const driver = drivers[0]?.name?.split(" ").slice(0, 2).join(" ") ?? "";

  const title =
    o.typeCode === "GENERICO"
      ? (o.reportTitle ?? o.typeTitle ?? "GENERICO")
      : (o.typeTitle ?? o.typeCode ?? "OCORRENCIA");

  const abbr = abbreviateTitle(title);

  return [vehicle, driver, abbr, date].filter(Boolean).join(" - ") + ".pdf";
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function sendOccurrenceToDriveHandler(
  req: Request,
  res: Response,
) {
  try {
    const occurrenceId = req.params.id;

    if (typeof occurrenceId !== "string" || !occurrenceId) {
      throw new AppError(400, "Parâmetro :id inválido", "BAD_OCCURRENCE_ID");
    }

    // Token e pasta enviados pelo frontend (fluxo OAuth do usuário)
    const accessToken: string | undefined = req.body?.accessToken;
    const folderIdFromBody: string | undefined = req.body?.folderId;
    const fileNameOverride: string | undefined = req.body?.fileName;
    const force: boolean = !!req.body?.force; // substitui o arquivo existente se force=true

    if (accessToken && !folderIdFromBody) {
      throw new AppError(400, "folderId é obrigatório quando accessToken é enviado", "BAD_FOLDER_ID");
    }

    // 1. Garante que o PDF existe no Supabase (usa cache se disponível)
    const pdfResult = await buildOccurrencePdf({
      occurrenceId,
      force: false,
      maxPhotos: 20,
    });

    // 2. Baixa o buffer do PDF do Supabase Storage
    const pdfBuffer = await downloadPrivateFileAsBuffer(
      REPORTS_BUCKET,
      pdfResult.pdfStoragePath,
    );

    // 3. Busca dados para montar o nome do arquivo
    const [occurrence, drivers] = await Promise.all([
      getOccurrenceForPdf(occurrenceId),
      listDriversByOccurrence(occurrenceId),
    ]);

    const fileName = fileNameOverride || buildFileName(occurrence, drivers);

    // 4. Faz upload — upsert (se force=true) ou create; usa token do usuário se disponível
    const driveResult = accessToken && folderIdFromBody
      ? force
        ? await upsertPdfToDriveWithToken({ pdfBuffer, fileName, folderId: folderIdFromBody, accessToken })
        : await uploadPdfToDriveWithToken({ pdfBuffer, fileName, folderId: folderIdFromBody, accessToken })
      : await uploadPdfToDrive({ pdfBuffer, fileName });

    return res.status(200).json({
      data: {
        occurrenceId,
        drive: {
          fileId: driveResult.fileId,
          fileName: driveResult.fileName,
          webViewLink: driveResult.webViewLink,
        },
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return res
        .status(err.status)
        .json({ error: { code: err.code, message: err.message } });
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[sendOccurrenceToDriveHandler] erro:", err);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: detail },
    });
  }
}
