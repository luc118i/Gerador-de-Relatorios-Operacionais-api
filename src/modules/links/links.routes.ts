import type { Express } from "express";
import { z } from "zod";
import { shortenUrl } from "./links.service.js";

const shortenSchema = z.object({
  // Aceita lote — o relatório diário pode ter várias ocorrências com link
  // do Drive na mesma mensagem, uma chamada só evita N round-trips.
  urls: z.array(z.string().url()).min(1).max(100),
});

export function linksRoutes(app: Express) {
  app.post("/links/shorten", async (req, res, next) => {
    try {
      const parsed = shortenSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: { code: "INVALID_PAYLOAD", issues: parsed.error.issues } });
      }
      const entries = await Promise.all(
        parsed.data.urls.map(async (url) => [url, await shortenUrl(url)] as const),
      );
      res.json({ data: Object.fromEntries(entries) });
    } catch (err) {
      next(err);
    }
  });
}
