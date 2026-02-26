import "dotenv/config"; // 1. Carrega as variáveis primeiro
import { app } from "./core/http/app.js";
import express from "express"; // Importe o express para o middleware
import { registerRoutes } from "./core/http/router.js";
import { errorHandler } from "./core/http/errorHandler.js";
import { ENV } from "./core/config/env.js";

// 2. Middlewares de Configuração (OBRIGATÓRIO ANTES DAS ROTAS)
app.use(express.json());

// 3. Registro de Rotas
registerRoutes(app);

// 4. Tratamento de Erros (SEMPRE DEPOIS DAS ROTAS)
app.use(errorHandler);

app.get("/health", (_, res) => res.json({ ok: true }));

app.listen(ENV.PORT, () => {
  console.log(`🚀 API running on http://localhost:${ENV.PORT}`);
  console.log("VERSION 2 - METADATA PATCH ATIVO");
});
