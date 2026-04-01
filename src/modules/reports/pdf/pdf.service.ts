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

  const occurrence = await getOccurrenceForPdf(occurrenceId);

  const [drivers, evidences] = await Promise.all([
    listDriversByOccurrence(occurrenceId),
    listEvidencesByOccurrence(occurrenceId),
  ] as const);

  if (evidences.length > maxPhotos) {
    throw new AppError(
      413,
      `Limite de evidências excedido (max ${maxPhotos})`,
      "EVIDENCES_LIMIT",
    );
  }

  const pdfStoragePath = `occurrences/${occurrenceId}/report.pdf`;

  if (!force) {
    const exists = await pdfExists(REPORTS_BUCKET, pdfStoragePath);

    if (exists) {
      const signedUrl = await createSignedUrl(
        REPORTS_BUCKET,
        pdfStoragePath,
        ttlSeconds,
      );

      return { pdfStoragePath, signedUrl, ttlSeconds, cached: true };
    }
  }

  const embedded = await Promise.all(
    evidences.map(async (e: any) => {
      const buf = await downloadPrivateFileAsBuffer(
        EVIDENCES_BUCKET,
        e.storagePath,
      );

      const guessed = mime.lookup(e.storage_path || e.storagePath);
      const mimeType =
        e.mime_type ??
        e.mimeType ??
        (guessed ? String(guessed) : "application/octet-stream");

      const b64 = buf.toString("base64");

      return {
        dataUri: `data:${mimeType};base64,${b64}`,
        caption: e.caption ?? "",

        linkTexto: String(e.linkTexto || "").trim(),
        linkUrl: String(e.linkUrl || "").trim(),
      };
    }),
  );

  const html = buildOccurrencePdfHtml({
    occurrence,
    drivers,
    reportText: "",
    reportHtml: buildReportHtml(occurrence),
    evidences: embedded,
    logoDataUri: getLogoDataUri(),
  });

  const pdfBuffer = await renderPdfFromHtml(html);

  await uploadPrivatePdf(REPORTS_BUCKET, pdfStoragePath, pdfBuffer);

  const signedUrl = await createSignedUrl(
    REPORTS_BUCKET,
    pdfStoragePath,
    ttlSeconds,
  );

  return { pdfStoragePath, signedUrl, ttlSeconds, cached: false };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmtDateBr(iso: string) {
  const [y, m, d] = (iso ?? "").split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function fmtTimeBr(hhmm: string) {
  const [h, m] = (hhmm ?? "").slice(0, 5).split(":");
  if (!h || !m) return hhmm;
  return `${h}h${m}`;
}

import type { PdfOccurrence } from "./pdf.types.js";

function esc(s: string) {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function b(s: string) {
  return `<strong>${esc(s)}</strong>`;
}

function buildReportHtml(o: PdfOccurrence): string | undefined {
  const date = fmtDateBr(o.eventDate);
  const tripDate = fmtDateBr(o.tripDate);
  const start = fmtTimeBr(o.startTime);
  const prefixo = o.vehicleNumber ?? "—";
  const linha = o.lineLabel ? ` (${esc(o.lineLabel)})` : "";

  switch (o.typeCode) {
    case "EXCESSO_VELOCIDADE": {
      const vel = o.speedKmh ? `${o.speedKmh} km/h` : "velocidade não informada";
      return (
        `Em viagem realizada pelo veículo ${b(prefixo)} iniciada no dia ${b(tripDate)}, ` +
        `identificamos que o motorista excedeu o limite de velocidade pré-estabelecido por diversas vezes. ` +
        `No dia ${b(date)}, às ${b(start)} chegou a atingir a velocidade de ${b(vel)}, ` +
        `colocando em perigo não somente a própria integridade física, mas também a dos demais passageiros e usuários da rodovia.` +
        `<br/><br/>` +
        `Essa conduta irresponsável representou um potencial risco de acidente ou colisão, ` +
        `configurando um flagrante de violação das normas de trânsito do CTB e um sério ` +
        `desrespeito à segurança viária.`
      );
    }
    default:
      // undefined → template usa o fallback visual padrão (com <strong>)
      return undefined;
  }
}
