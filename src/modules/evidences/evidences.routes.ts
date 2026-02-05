import type { Express } from "express";
import multer from "multer";
import { uploadEvidences, getEvidences } from "./evidences.service";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 20,
    fileSize: 8 * 1024 * 1024, // 8MB por arquivo (ajuste se quiser)
  },
});

export function evidencesRoutes(app: Express) {
  app.post(
    "/occurrences/:id/evidences",
    upload.array("files", 20),
    async (req, res) => {
      const occurrenceId = String(req.params.id);
      const files = (req.files as Express.Multer.File[]) ?? [];

      if (!occurrenceId)
        return res.status(400).json({ error: "missing occurrence id" });
      if (!files.length)
        return res.status(400).json({ error: "no files uploaded" });

      const data = await uploadEvidences({ occurrenceId, files });
      res.json({ data, count: data.length });
    },
  );

  app.get("/occurrences/:id/evidences", async (req, res) => {
    const occurrenceId = req.params.id;
    const data = await getEvidences(occurrenceId);
    res.json({ data, count: data.length });
  });
}
