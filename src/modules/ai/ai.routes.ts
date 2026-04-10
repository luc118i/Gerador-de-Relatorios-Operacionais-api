import type { Express } from "express";
import { z } from "zod";
import { summarizeOccurrenceText, correctOccurrenceText } from "./ai.service.js";

const summarizeSchema = z.object({
  text: z.string().min(10, "Texto muito curto para resumir"),
  title: z.string().optional(),
});

export function aiRoutes(app: Express) {
  app.post("/ai/correct", async (req, res, next) => {
    try {
      const { html, plainText } = req.body;
      if (!html || typeof html !== "string" || html.trim().length < 5) {
        return res.status(400).json({ error: { code: "INVALID_PAYLOAD", message: "Campo html obrigatório." } });
      }
      const plain = typeof plainText === "string" && plainText.trim() ? plainText : html.replace(/<[^>]+>/g, " ").trim();
      const result = await correctOccurrenceText(html, plain);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post("/ai/summarize", async (req, res, next) => {
    try {
      const parsed = summarizeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: { code: "INVALID_PAYLOAD", message: "Payload inválido", issues: parsed.error.issues },
        });
      }

      const { text, title } = parsed.data;
      const summary = await summarizeOccurrenceText(text, title);
      res.json({ summary });
    } catch (err: any) {
      next(err);
    }
  });
}
