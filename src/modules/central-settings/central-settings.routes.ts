import type { Express } from "express";
import multer from "multer";

import {
  clearCover,
  getCover,
  patchCover,
  setCover,
} from "./central-settings.service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

export function centralSettingsRoutes(app: Express) {
  // Imagem de fundo do cabeçalho da Central — compartilhada entre todos.
  app.get("/central/cover", async (_req, res, next) => {
    try {
      res.json({ data: await getCover() });
    } catch (err) {
      next(err);
    }
  });

  app.put("/central/cover", upload.single("file"), async (req, res, next) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: "arquivo ausente" });
      if (!file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "arquivo não é uma imagem" });
      }
      const updatedBy = String(req.body?.actorNome ?? "").trim() || null;
      res.json({ data: await setCover(file.buffer, file.mimetype, updatedBy) });
    } catch (err) {
      next(err);
    }
  });

  // Ajuste fino da capa (enquadramento vertical + opacidade) — sem reenviar imagem.
  app.patch("/central/cover", async (req, res, next) => {
    try {
      const body = (req.body ?? {}) as { posY?: unknown; opacity?: unknown };
      const patch: { posY?: number; opacity?: number } = {};
      if (body.posY !== undefined) {
        const n = Number(body.posY);
        if (!Number.isFinite(n)) {
          return res.status(400).json({ error: "posY inválido" });
        }
        patch.posY = n;
      }
      if (body.opacity !== undefined) {
        const n = Number(body.opacity);
        if (!Number.isFinite(n)) {
          return res.status(400).json({ error: "opacity inválido" });
        }
        patch.opacity = n;
      }
      const updatedBy = String(req.body?.actorNome ?? "").trim() || null;
      res.json({ data: await patchCover(patch, updatedBy) });
    } catch (err) {
      next(err);
    }
  });

  app.delete("/central/cover", async (req, res, next) => {
    try {
      const updatedBy = String(req.query?.actorNome ?? "").trim() || null;
      res.json({ data: await clearCover(updatedBy) });
    } catch (err) {
      next(err);
    }
  });
}
