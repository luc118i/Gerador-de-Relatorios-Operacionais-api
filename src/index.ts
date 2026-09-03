import "dotenv/config"; // 1. Carrega as variáveis primeiro
import { app } from "./core/http/app.js";
import express from "express"; // Importe o express para o middleware
import { registerRoutes } from "./core/http/router.js";
import { errorHandler } from "./core/http/errorHandler.js";
import { ENV } from "./core/config/env.js";
import { locaisRoutes } from "./modules/locais/locais.routes.js";
import { canonBase, stripDiacritics } from "./shared/normalizer/index.js";

// 2. Middlewares de Configuração (OBRIGATÓRIO ANTES DAS ROTAS)
app.use(express.json());

// 3. Registro de Rotas
registerRoutes(app);
locaisRoutes(app);

app.get("/", (_, res) =>
  res.json({
    name: "Gerador de Relatorios Operacionais API",
    status: "online",
    health: "/health",
    docs: "http://localhost:3000",
  }),
);

app.get("/health", (_, res) => res.json({ ok: true }));

// Diagnostico temporario: confirma qual build de normalizer esta rodando.
app.get("/_diag/normalizer", (_, res) =>
  res.json({
    commit: process.env.KOYEB_GIT_SHA ?? process.env.GIT_SHA ?? null,
    node: process.version,
    icuNormalizeWorks: "é".normalize("NFD").length === 2,
    stripDiacritics: stripDiacritics("São José brasília"),
    canonBase: canonBase("  são josé dos campos  "),
  }),
);

// 4. Tratamento de Erros (SEMPRE DEPOIS DAS ROTAS)
app.use(errorHandler);

app.listen(ENV.PORT, () => {
  console.log(`API running on http://localhost:${ENV.PORT}`);
});
