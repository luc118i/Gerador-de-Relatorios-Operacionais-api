import type { Express } from "express";
import multer from "multer";
import {
  uploadEvidences,
  getEvidences,
  updateEvidenceCaption,
} from "./evidences.service.js";
import { getOccurrenceById } from "../occurrences/occurrences.repo.js";
import { getSignedUrl, uploadFileToBucket, insertEvidenceRow, listEvidencesByOccurrence } from "./evidences.repo.js";
import { renderSuspensaoPdfFromHtml } from "../reports/pdf/pdf.puppeteer.js";

const MAX_FILES = 30;
const MAX_PHOTOS = 20;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_FILES,
    fileSize: 8 * 1024 * 1024,
  },
});

export function evidencesRoutes(app: Express) {
  app.post(
    "/occurrences/:id/evidences",
    upload.array("files", MAX_FILES),
    async (req, res) => {
      const occurrenceId = String(req.params.id);
      const files = (req.files as Express.Multer.File[]) ?? [];

      if (!occurrenceId)
        return res.status(400).json({ error: "missing occurrence id" });

      if (!files.length)
        return res.status(400).json({ error: "no files uploaded" });

      // Valida limite de fotos antes de gravar qualquer coisa
      let existingPhotos: Awaited<ReturnType<typeof listEvidencesByOccurrence>> = [];
      try {
        const existing = await listEvidencesByOccurrence(occurrenceId);
        existingPhotos = existing.filter(
          (e) => !e.storagePath?.toLowerCase().endsWith(".pdf"),
        );
      } catch {
        // Se a query falhar, rejeita por segurança
        return res.status(500).json({ error: "Falha ao verificar evidências existentes", code: "EVIDENCES_QUERY_FAILED" });
      }

      const newPhotos = files.filter((f) => !f.mimetype.includes("pdf"));

      console.log(`[upload-evidences] occurrenceId=${occurrenceId} existing=${existingPhotos.length} incoming=${newPhotos.length} limit=${MAX_PHOTOS}`);

      if (existingPhotos.length + newPhotos.length > MAX_PHOTOS) {
        return res.status(413).json({
          error: `Limite de ${MAX_PHOTOS} fotos por ocorrência excedido. Já existem ${existingPhotos.length} foto(s) e você está tentando adicionar mais ${newPhotos.length}.`,
          code: "EVIDENCES_LIMIT",
        });
      }

      // Metadados opcionais enviados pelo frontend
      let metadata: any[] = [];
      if (req.body.metadata) {
        try {
          metadata = JSON.parse(req.body.metadata);
        } catch {
          return res.status(400).json({ error: "invalid metadata json" });
        }
      }

      const data = await uploadEvidences({
        occurrenceId,
        files,
        metadata,
      });

      res.json({ data, count: data.length });
    },
  );

  app.get("/occurrences/:id/evidences/signed-urls", async (req, res) => {
    try {
      const { id } = req.params;
      const occ = await getOccurrenceById(id);

      const urls = await Promise.all(
        (occ.evidences ?? []).map(async (e: any) => ({
          id: e.id,
          url: await getSignedUrl(e.storagePath),
          caption: e.caption ?? "",
          linkTexto: e.linkTexto ?? "",
          linkUrl: e.linkUrl ?? "",
        })),
      );

      res.json({ data: urls });
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? "Erro ao gerar URLs" });
    }
  });
  app.patch(
    "/occurrences/:id/evidences/:evidenceId",
    async (req, res) => {
      try {
        const { evidenceId } = req.params;
        const { caption } = req.body as { caption?: string };

        if (caption === undefined)
          return res.status(400).json({ error: "missing caption" });

        await updateEvidenceCaption(evidenceId, caption);
        res.json({ ok: true });
      } catch (err: any) {
        res
          .status(500)
          .json({ error: err?.message ?? "Erro ao atualizar legenda" });
      }
    },
  );

  app.get("/occurrences/:id/evidences", async (req, res) => {
    const occurrenceId = req.params.id;
    const data = await getEvidences(occurrenceId);
    res.json({ data, count: data.length });
  });

  app.post("/occurrences/:id/esquema-pdf-evidence", async (req, res) => {
    try {
      const occurrenceId = String(req.params.id ?? "");
      const esquemaHtml = String(req.body?.esquemaHtml ?? "").trim();

      if (!occurrenceId) return res.status(400).json({ error: "missing occurrence id" });
      if (!esquemaHtml) return res.status(400).json({ error: "esquemaHtml vazio — sem esquema disponível" });

      const fullHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: "Segoe UI", Arial, sans-serif; margin: 0; padding: 16mm 16mm 16mm 16mm; font-size: 11pt; color: #111; }
    table { border-collapse: collapse; }
    h4 { margin-top: 0; }
  </style>
</head>
<body>${esquemaHtml}</body>
</html>`;

      const pdfBuffer = await renderSuspensaoPdfFromHtml(fullHtml);

      const storagePath = await uploadFileToBucket({
        occurrenceId,
        filename: "esquema-operacional.pdf",
        mimeType: "application/pdf",
        buffer: pdfBuffer,
      });

      const row = await insertEvidenceRow({
        occurrenceId,
        sortOrder: 1,
        storagePath,
        caption: "Esquema Operacional",
      });

      return res.status(201).json({ evidenceId: row.id });
    } catch (err: any) {
      console.error("[esquema-pdf-evidence] erro:", err);
      return res.status(500).json({ error: err?.message ?? "Erro ao gerar PDF do esquema" });
    }
  });
}
