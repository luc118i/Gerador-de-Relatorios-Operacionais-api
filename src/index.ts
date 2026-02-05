import { app } from "./core/http/app";
import { registerRoutes } from "./core/http/router";
import { errorHandler } from "./core/http/errorHandler";
import { ENV } from "./core/config/env";
import "dotenv/config";

registerRoutes(app);
app.use(errorHandler);

app.get("/health", (_, res) => res.json({ ok: true }));

app.listen(ENV.PORT, () => {
  console.log(`🚀 API running on http://localhost:${ENV.PORT}`);
});
