import mime from "mime-types";
import sharp from "sharp";
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
  uploadPrivateFile,
  createSignedUrl,
  pdfExists,
} from "./pdf.storage.js";
import { buildOccurrencePdfHtml, buildGenericOccurrencePdfHtml, buildAnaliseOpPdfHtml } from "./pdf.template.js";
import { extractExcessos, buildExcessoParadaReportHtml, type ExcessoEvidence } from "./excesso-parada.template.js";
import { getTempoPermanenciaMap } from "../../telemetry/repositories/tempo-permanencia.repo.js";
import { renderPdfFromHtml } from "./pdf.puppeteer.js";
import { renderDocxFromHtml } from "./docx.render.js";
import type { BuildPdfResult, PdfEvidence, PdfOccurrence, PdfDriver } from "./pdf.types.js";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const EVIDENCES_BUCKET = process.env.SUPABASE_BUCKET ?? "occurrence-evidences";
const REPORTS_BUCKET = process.env.SUPABASE_REPORTS_BUCKET ?? "reports";

/**
 * Monta o HTML de uma ocorrência (mesma fonte usada por PDF e DOCX).
 * Faz o fetch da ocorrência, embute as evidências e seleciona o template
 * conforme o typeCode.
 */
async function buildOccurrenceHtml(
  occurrenceId: string,
  maxPhotos: number,
): Promise<string> {
  const occurrence = await getOccurrenceForPdf(occurrenceId);

  const [drivers, evidences] = await Promise.all([
    listDriversByOccurrence(occurrenceId),
    listEvidencesByOccurrence(occurrenceId),
  ] as const);

  // PDFs de esquema operacional são gravados como evidências mas não contam como fotos
  const photoEvidences = evidences.filter(
    (e) => !e.storagePath?.toLowerCase().endsWith(".pdf"),
  );

  if (photoEvidences.length > maxPhotos) {
    throw new AppError(
      413,
      `Limite de evidências excedido (max ${maxPhotos})`,
      "EVIDENCES_LIMIT",
    );
  }

  const embedded = await Promise.all(
    photoEvidences.map(async (e: any) => {
      let buf = await downloadPrivateFileAsBuffer(
        EVIDENCES_BUCKET,
        e.storagePath,
      );

      const guessed = mime.lookup(e.storage_path || e.storagePath);
      const mimeType =
        e.mime_type ??
        e.mimeType ??
        (guessed ? String(guessed) : "application/octet-stream");

      // Reduz imagens grandes antes de embutir como base64
      // Limite: 1200px de largura, qualidade JPEG 75% — reduz drasticamente o HTML
      if (mimeType.startsWith("image/") && !mimeType.includes("svg")) {
        try {
          buf = await sharp(buf)
            .resize({ width: 1200, withoutEnlargement: true })
            .jpeg({ quality: 75 })
            .toBuffer();
        } catch {
          // mantém original se sharp falhar (ex: gif animado)
        }
      }

      const b64 = buf.toString("base64");

      return {
        dataUri: `data:image/jpeg;base64,${b64}`,
        caption: e.caption ?? "",
        linkTexto: String(e.linkTexto || "").trim(),
        linkUrl: String(e.linkUrl || "").trim(),
      };
    }),
  );

  // Seleciona template pelo typeCode
  if (occurrence.typeCode === "GENERICO") {
    return buildGenericOccurrencePdfHtml({
      occurrence,
      drivers,
      evidences: embedded,
      logoDataUri: getLogoDataUri(),
    });
  }
  if (occurrence.typeCode === "ANALISE_OP") {
    return buildAnaliseOpPdfHtml({
      occurrence,
      drivers,
      evidences: embedded,
      logoDataUri: getLogoDataUri(),
    });
  }
  if (occurrence.typeCode === "EXCESSO_PERMANENCIA") {
    return buildExcessoPermanenciaHtml(occurrence, drivers, embedded);
  }

  const isParadaFora = occurrence.typeCode === "DESCUMP_OP_PARADA_FORA";
  // For DESCUMP_OP_PARADA_FORA: standard text before evidences, schema after
  const reportHtml = isParadaFora
    ? undefined
    : (buildReportHtml(occurrence) ?? occurrence.relatoHtml ?? undefined);
  const schemaHtml = isParadaFora
    ? (occurrence.relatoHtml ?? undefined)
    : undefined;

  return buildOccurrencePdfHtml({
    occurrence,
    drivers,
    reportText: "",
    ...(reportHtml !== undefined && { reportHtml }),
    ...(schemaHtml !== undefined && { schemaHtml }),
    evidences: embedded,
    logoDataUri: getLogoDataUri(),
  });
}

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

  const html = await buildOccurrenceHtml(occurrenceId, maxPhotos);
  const pdfBuffer = await renderPdfFromHtml(html);

  await uploadPrivatePdf(REPORTS_BUCKET, pdfStoragePath, pdfBuffer);

  const signedUrl = await createSignedUrl(
    REPORTS_BUCKET,
    pdfStoragePath,
    ttlSeconds,
  );

  return { pdfStoragePath, signedUrl, ttlSeconds, cached: false };
}

export type BuildDocxResult = {
  storagePath: string;
  signedUrl: string;
  ttlSeconds: number;
  cached: boolean;
};

/**
 * Gera o relatório em Word (.docx) a partir do mesmo HTML do PDF.
 * Cacheia em Storage como report.docx e devolve uma signed URL.
 */
export async function buildOccurrenceDocx(args: {
  occurrenceId: string;
  force?: boolean;
  ttlSeconds?: number;
  maxPhotos?: number;
}): Promise<BuildDocxResult> {
  const occurrenceId = args.occurrenceId;
  const force = args.force ?? false;

  const ttlSeconds = clamp(
    args.ttlSeconds ?? Number(process.env.REPORTS_PDF_TTL ?? 3600),
    60,
    86400,
  );
  const maxPhotos = clamp(args.maxPhotos ?? 20, 1, 50);

  const storagePath = `occurrences/${occurrenceId}/report.docx`;

  if (!force) {
    const exists = await pdfExists(REPORTS_BUCKET, storagePath);
    if (exists) {
      const signedUrl = await createSignedUrl(
        REPORTS_BUCKET,
        storagePath,
        ttlSeconds,
      );
      return { storagePath, signedUrl, ttlSeconds, cached: true };
    }
  }

  const html = await buildOccurrenceHtml(occurrenceId, maxPhotos);
  const docxBuffer = await renderDocxFromHtml(html);

  await uploadPrivateFile(REPORTS_BUCKET, storagePath, docxBuffer, DOCX_MIME);

  const signedUrl = await createSignedUrl(
    REPORTS_BUCKET,
    storagePath,
    ttlSeconds,
  );

  return { storagePath, signedUrl, ttlSeconds, cached: false };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Monta o PDF de Excesso de Permanência a partir de uma ocorrência persistida.
 * O excesso é calculado na hora: parada = endTime - startTime (trata virada de
 * meia-noite) e o tempo permitido vem de TEMPO_PERMANENCIA por local (com
 * fallback ao limite padrão para locais sem cadastro).
 */
async function buildExcessoPermanenciaHtml(
  occurrence: PdfOccurrence,
  drivers: PdfDriver[],
  evidences: ExcessoEvidence[],
): Promise<string> {
  const tempoMap = await getTempoPermanenciaMap();

  const eventDate = occurrence.eventDate;
  const startTime = (occurrence.startTime ?? "").slice(0, 5);
  const endTime = (occurrence.endTime ?? "").slice(0, 5);

  const [hi, mi] = startTime.split(":").map(Number) as [number, number];
  const [hf, mf] = endTime.split(":").map(Number) as [number, number];

  // Parada que cruza a meia-noite: saída no dia seguinte
  let saidaDate = eventDate;
  if (hf * 60 + mf <= hi * 60 + mi) {
    const next = new Date(`${eventDate}T00:00:00`);
    next.setDate(next.getDate() + 1);
    const yyyy = next.getFullYear();
    const mm = String(next.getMonth() + 1).padStart(2, "0");
    const dd = String(next.getDate()).padStart(2, "0");
    saidaDate = `${yyyy}-${mm}-${dd}`;
  }

  let paradaS = (hf * 60 + mf - (hi * 60 + mi)) * 60;
  if (paradaS <= 0) paradaS += 24 * 3600;

  const placeLc = (occurrence.place ?? "").toLowerCase();
  const rodoviaria = /rodovi[áa]ri/.test(placeLc);
  const garagem = placeLc.includes("garagem");

  const excessos = extractExcessos(
    [
      {
        seq: 1,
        ponto: occurrence.place ?? "",
        entrada: `${eventDate} ${startTime}:00`,
        saida: `${saidaDate} ${endTime}:00`,
        parada_s: paradaS,
        rodoviaria,
        garagem,
      },
    ],
    tempoMap,
    { fuzzy: true },
  );

  const motorista = drivers
    .map((d) => [d.code, d.name || "—", d.baseCode].filter(Boolean).join(" - "))
    .join(" / ");

  return buildExcessoParadaReportHtml({
    prefixo: occurrence.vehicleNumber ?? "—",
    dataViagem: occurrence.tripDate ?? "",
    dataEvento: occurrence.eventDate ?? "",
    motorista: motorista || null,
    excessos,
    evidences,
    logoDataUri: getLogoDataUri(),
  });
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
      const vel = o.speedKmh
        ? `${o.speedKmh} km/h`
        : "velocidade não informada";
      return (
        `Em viagem realizada pelo veículo ${b(prefixo)} iniciada no dia ${b(date)}, ` +
        `identificamos que o motorista excedeu o limite de velocidade pré-estabelecido por diversas vezes. ` +
        `No dia ${b(tripDate)}, às ${b(start)} chegou a atingir a velocidade de ${b(vel)}, ` +
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
