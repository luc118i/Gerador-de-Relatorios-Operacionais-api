import {
  getSignedUrl,
  insertEvidenceRow,
  listEvidencesByOccurrence,
  uploadFileToBucket,
} from "./evidences.repo.js";

import sharp from "sharp";

export async function uploadEvidences(args: {
  occurrenceId: string;
  files: Express.Multer.File[];
}) {
  const out: Array<{
    id: string;
    sortOrder: number;
    storagePath: string;
    url?: string;
  }> = [];

  let sortOrder = 1;

  for (const file of args.files) {
    // --- NOVO BLOCO DE REDIMENSIONAMENTO ---
    let finalBuffer = file.buffer;

    // Só processa se for imagem (ignora se for PDF ou outro arquivo)
    if (file.mimetype.startsWith("image/")) {
      finalBuffer = await sharp(file.buffer)
        .resize(800) // Limita a largura a 800px (mantém proporção)
        .jpeg({ quality: 80 }) // Converte para JPEG (mais leve que PNG)
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
