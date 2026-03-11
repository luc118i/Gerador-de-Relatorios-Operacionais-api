import mime from "mime-types";

import { AppError } from "./pdf.errors.js";
import { renderTemplate } from "./utils/pdf.utils.js";
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

import { buildRelatoVelocidade } from "../pdf/templates/relato.velocidade.js";

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

  // ---------------------------------------------------------------------------
  // 1. Buscar dados
  // ---------------------------------------------------------------------------

  const occurrence = await getOccurrenceForPdf(occurrenceId);

  const [drivers, evidences] = await Promise.all([
    listDriversByOccurrence(occurrenceId),
    listEvidencesByOccurrence(occurrenceId),
  ]);

  if (evidences.length > maxPhotos) {
    throw new AppError(413, "Limite de fotos excedido", "EVIDENCES_LIMIT");
  }

  const pdfStoragePath = `occurrences/${occurrenceId}/report.pdf`;

  // ---------------------------------------------------------------------------
  // 2. Cache do PDF
  // ---------------------------------------------------------------------------

  if (!force) {
    const exists = await pdfExists(REPORTS_BUCKET, pdfStoragePath);

    if (exists) {
      const signedUrl = await createSignedUrl(
        REPORTS_BUCKET,
        pdfStoragePath,
        ttlSeconds,
      );

      return {
        pdfStoragePath,
        signedUrl,
        ttlSeconds,
        cached: true,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Processar evidências
  // ---------------------------------------------------------------------------

  const embedded = await embedEvidenceImages(evidences);

  // ---------------------------------------------------------------------------
  // 4. Construir texto do relato
  // ---------------------------------------------------------------------------

  const reportText = buildReportText(occurrence);

  // ---------------------------------------------------------------------------
  // 5. Montar HTML
  // ---------------------------------------------------------------------------

  const html = buildOccurrencePdfHtml({
    occurrence,
    drivers,
    reportText,
    evidences: embedded,
    logoDataUri: getLogoDataUri(),
  });

  // ---------------------------------------------------------------------------
  // 6. Gerar PDF
  // ---------------------------------------------------------------------------

  const pdfBuffer = await renderPdfFromHtml(html);

  await uploadPrivatePdf(REPORTS_BUCKET, pdfStoragePath, pdfBuffer);

  const signedUrl = await createSignedUrl(
    REPORTS_BUCKET,
    pdfStoragePath,
    ttlSeconds,
  );

  return {
    pdfStoragePath,
    signedUrl,
    ttlSeconds,
    cached: false,
  };
}

async function embedEvidenceImages(evidences: PdfEvidence[]) {
  return Promise.all(
    evidences.map(async (e) => {
      const buf = await downloadPrivateFileAsBuffer(
        EVIDENCES_BUCKET,
        e.storagePath,
      );

      const guessedMime = mime.lookup(e.storagePath);

      const mimeType =
        e.mimeType ??
        (guessedMime ? String(guessedMime) : "application/octet-stream");

      return {
        dataUri: `data:${mimeType};base64,${buf.toString("base64")}`,
        caption: e.caption ?? "",
        linkTexto: (e.linkTexto ?? "").trim(),
        linkUrl: (e.linkUrl ?? "").trim(),
      };
    }),
  );
}

function buildReportText(occurrence: any): string {
  const isVelocidade = occurrence.typeCode?.includes("VELOCIDADE") ?? false;

  if (isVelocidade) {
    console.log("EXTRA DA OCORRENCIA:", occurrence.extra);
    console.log("VELOCIDADE:", occurrence.extra?.velocidade);

    return buildRelatoVelocidade({
      occurrenceType:
        occurrence.typeCode ?? occurrence.typeTitle ?? "Excesso de Velocidade",

      data: {
        vehicleNumber: occurrence.vehicleNumber ?? "—",
        tripDateLabel: fmtDate(occurrence.tripDate) ?? "—",
        eventDateLabel: fmtDate(occurrence.eventDate) ?? "—",
        horarioEvento: fmtTime(occurrence.startTime) ?? "—",
        velocidade: occurrence.extra?.velocidade ?? "—",
      },
    });
  }

  const variables = {
    vehicle_number: occurrence.vehicleNumber ?? "—",
    event_date: fmtDate(occurrence.eventDate) ?? "—",
    trip_date: fmtDate(occurrence.tripDate) ?? "—",
    start_time: fmtTime(occurrence.startTime) ?? "—",
    end_time: fmtTime(occurrence.endTime) ?? "—",
    place: occurrence.place ?? "—",
    base_code: occurrence.baseCode ?? "—",
    line_label: occurrence.lineLabel ?? "—",
  };

  if (!occurrence.dailyTemplate) {
    return "";
  }

  return renderTemplate(occurrence.dailyTemplate, variables);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso?: string | null) {
  if (!iso || iso === "null") {
    return "—";
  }

  const [y, m, d] = iso.split("-");

  if (!y || !m || !d) {
    return "—";
  }

  return `${d}/${m}/${y}`;
}

function fmtTime(time?: string | null) {
  if (!time || time === "null") {
    return "—";
  }

  const [hh, mm] = time.split(":");

  if (!hh || !mm) {
    return "—";
  }

  return `${hh}h${mm}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
