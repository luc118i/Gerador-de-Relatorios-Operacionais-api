import { app } from "./core/http/app.js";
import { registerRoutes } from "./core/http/router.js";
import { errorHandler } from "./core/http/errorHandler.js";
import { ENV } from "./core/config/env.js";
import "dotenv/config";

registerRoutes(app);
app.use(errorHandler);

app.get("/health", (_, res) => res.json({ ok: true }));

app.listen(ENV.PORT, () => {
  console.log(`🚀 API running on http://localhost:${ENV.PORT}`);
});
