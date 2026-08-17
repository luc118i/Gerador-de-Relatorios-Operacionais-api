import {
  getSignedUrl,
  insertEvidenceRow,
  listEvidencesByOccurrence,
  updateEvidenceCaptionInDb,
  uploadFileToBucket,
} from "./evidences.repo.js";

import sharp from "sharp";

export async function uploadEvidences(args: {
  occurrenceId: string;
  files: Express.Multer.File[];
  metadata: Array<{
    caption?: string | null;
    linkTexto?: string | null;
    linkUrl?: string | null;
  }>;
}) {
  const out: Array<{
    id: string;
    sortOrder: number;
    storagePath: string;
    url?: string;
  }> = [];

  let sortOrder = 1;

  for (let i = 0; i < args.files.length; i++) {
    const file = args.files[i];
    if (!file) continue;
    const meta = args.metadata?.[i] ?? {};
    // --- NOVO BLOCO DE REDIMENSIONAMENTO ---
    let finalBuffer = file.buffer;

    // Só processa se for imagem (ignora se for PDF ou outro arquivo).
    // Esse é o ÚNICO lugar onde a foto é recomprimida — o PDF/DOCX embute
    // esse buffer direto, sem reprocessar. mozjpeg dá mais qualidade no
    // mesmo tamanho de arquivo (ou o mesmo visual num arquivo menor) do que
    // o encoder padrão do libjpeg, sem custo extra relevante de CPU (roda
    // uma vez só, no upload).
    if (file.mimetype.startsWith("image/")) {
      finalBuffer = await sharp(file.buffer, { limitInputPixels: 60_000_000 })
        .rotate() // aplica a orientação EXIF antes de descartar os metadados
        .resize({ width: 1600, withoutEnlargement: true }) // suficiente pra impressão A4
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
    }
    // ---------------------------------------

    const storagePath = await uploadFileToBucket({
      occurrenceId: args.occurrenceId,
      filename: file.originalname.replace(/\.[^/.]+$/, ".jpg"), // Ajusta extensão para .jpg
      mimeType: "image/jpeg",
      buffer: finalBuffer, // Envia o buffer reduzido
    });

    const row = await insertEvidenceRow({
      occurrenceId: args.occurrenceId,
      sortOrder,
      storagePath,
      caption: meta.caption ?? null,
      linkTexto: meta.linkTexto ?? null,
      linkUrl: meta.linkUrl ?? null,
    });

    const url = await getSignedUrl(row.storage_path);

    out.push({
      id: row.id,
      sortOrder: row.sort_order,
      storagePath: row.storage_path,
      url,
    });

    sortOrder++;
  }

  return out;
}

export async function updateEvidenceCaption(
  evidenceId: string,
  caption: string,
) {
  await updateEvidenceCaptionInDb(evidenceId, caption);
}

export async function getEvidences(occurrenceId: string) {
  const rows = await listEvidencesByOccurrence(occurrenceId);

  return Promise.all(
    rows.map(async (r: any) => ({
      id: r.id,
      sortOrder: r.sort_order,
      storagePath: r.storage_path,
      caption: r.caption,
      createdAt: r.created_at,
      url: await getSignedUrl(r.storage_path),
    })),
  );
}
