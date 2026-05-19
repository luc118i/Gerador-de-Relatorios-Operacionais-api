import type { Express } from "express";
import { listPresets, createPreset, deletePreset } from "./presets.repo.js";

export function presetsRoutes(app: Express) {
  app.get("/occurrence-presets", async (_req, res) => {
    try {
      const data = await listPresets();
      res.json({ data });
    } catch {
      res.status(500).json({ error: "Failed to fetch presets" });
    }
  });

  app.post("/occurrence-presets", async (req, res) => {
    try {
      const { name } = req.body as { name?: string };
      if (!name?.trim()) {
        return res.status(400).json({ error: "name is required" });
      }
      const preset = await createPreset(name);
      res.status(201).json({ data: preset });
    } catch (err: any) {
      if (err?.code === "23505") {
        return res.status(409).json({ error: "Name already exists" });
      }
      res.status(500).json({ error: "Failed to create preset" });
    }
  });

  app.delete("/occurrence-presets/:id", async (req, res) => {
    try {
      await deletePreset(req.params.id);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Failed to delete preset" });
    }
  });
}
