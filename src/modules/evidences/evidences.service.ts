import {
  getSignedUrl,
  insertEvidenceRow,
  listEvidencesByOccurrence,
  uploadFileToBucket,
} from "./evidences.repo";

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
    const storagePath = await uploadFileToBucket({
      occurrenceId: args.occurrenceId,
      filename: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
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
