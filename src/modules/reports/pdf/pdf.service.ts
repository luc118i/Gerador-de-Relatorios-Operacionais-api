import mime from "mime-types";
import { AppError } from "./pdf.errors.js";
import { getLogoDataUri } from "./pdf.assets.js";
import {
  getOccurrenceForPdf,
  listDriversByOccurrence,
  listEvidencesByOccurrence,
} from "./pdf.repo.js";
import {
  downloadPrivateFileAsBuffer,
  uploadPrivatePdf,
  createSignedUrl,
  pdfExists,
} from "./pdf.storage.js";
import { buildOccurrencePdfHtml } from "./pdf.template.js";
import { renderPdfFromHtml } from "./pdf.puppeteer.js";
import type { BuildPdfResult, PdfEvidence } from "./pdf.types.js";

const EVIDENCES_BUCKET = process.env.SUPABASE_BUCKET ?? "occurrence-evidences";
const REPORTS_BUCKET = process.env.SUPABASE_REPORTS_BUCKET ?? "reports";

export async function buildOccurrencePdf(args: {
  occurrenceId: string;
  force?: boolean;
  ttlSeconds?: number;
  maxPhotos?: number;
}): Promise<BuildPdfResult> {
  const occurrenceId = args.occurrenceId;
  const force = args.force ?? false;

  const ttlSeconds = clamp(
    args.ttlSeconds ?? Number(process.env.REPORTS_PDF_TTL ?? 3600),
    60,
    86400,
  );
  const maxPhotos = clamp(args.maxPhotos ?? 20, 1, 50);

  console.log("[pdf] start", { occurrenceId, force, ttlSeconds, maxPhotos });

  const occurrence = await getOccurrenceForPdf(occurrenceId);
  console.log("[pdf] occurrence ok");

  const [drivers, evidences] = await Promise.all([
    listDriversByOccurrence(occurrenceId),
    listEvidencesByOccurrence(occurrenceId),
  ] as const);

  console.log("[pdf] fetched drivers/evidences", {
    drivers: drivers.length,
    evidences: evidences.length,
  });

  if (evidences.length > maxPhotos) {
    throw new AppError(
      413,
      `Limite de evidências excedido (max ${maxPhotos})`,
      "EVIDENCES_LIMIT",
    );
  }

  const pdfStoragePath = `occurrences/${occurrenceId}/report.pdf`;
  console.log("[pdf] pdfStoragePath", { pdfStoragePath });

  if (!force) {
    const exists = await pdfExists(REPORTS_BUCKET, pdfStoragePath);
    console.log("[pdf] cache check", { exists });

    if (exists) {
      const signedUrl = await createSignedUrl(
        REPORTS_BUCKET,
        pdfStoragePath,
        ttlSeconds,
      );
      console.log("[pdf] cache hit -> signedUrl ok");
      return { pdfStoragePath, signedUrl, ttlSeconds, cached: true };
    }
  }

  console.log("[pdf] embedding evidences...");

  const embedded = await Promise.all(
    evidences.map(async (e: PdfEvidence, idx: number) => {
      console.log("[pdf] download evidence", {
        idx: idx + 1,
        path: e.storagePath,
      });

      const buf = await downloadPrivateFileAsBuffer(
        EVIDENCES_BUCKET,
        e.storagePath,
      );

      const guessed = mime.lookup(e.storagePath);
      const mimeType =
        e.mimeType ?? (guessed ? String(guessed) : "application/octet-stream");

      const b64 = buf.toString("base64");
      return {
        dataUri: `data:${mimeType};base64,${b64}`,
        caption: e.caption ?? null,
      };
    }),
  );

  console.log("[pdf] embedded ok", { count: embedded.length });

  const html = buildOccurrencePdfHtml({
    occurrence,
    drivers,
    reportText: occurrence.reportText,
    evidences: embedded,
    logoDataUri: getLogoDataUri(),
  });

  console.log("[pdf] html ok", { chars: html.length });

  const pdfBuffer = await renderPdfFromHtml(html);
  console.log("[pdf] puppeteer ok", { bytes: pdfBuffer.length });

  await uploadPrivatePdf(REPORTS_BUCKET, pdfStoragePath, pdfBuffer);
  console.log("[pdf] upload ok");

  const signedUrl = await createSignedUrl(
    REPORTS_BUCKET,
    pdfStoragePath,
    ttlSeconds,
  );
  console.log("[pdf] signedUrl ok");

  return { pdfStoragePath, signedUrl, ttlSeconds, cached: false };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
