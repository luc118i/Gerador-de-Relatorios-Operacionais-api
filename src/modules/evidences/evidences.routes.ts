import type { Express } from "express";
import multer from "multer";
import {
  uploadEvidences,
  getEvidences,
  updateEvidenceCaption,
} from "./evidences.service.js";
import { getOccurrenceById } from "../occurrences/occurrences.repo.js";
import { getSignedUrl } from "./evidences.repo.js";

const MAX_FILES = 30;

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

      // 👇 NOVO BLOCO
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
}
