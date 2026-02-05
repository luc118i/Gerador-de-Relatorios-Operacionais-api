import "dotenv/config";

function req(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const ENV = {
  PORT: Number(process.env.PORT ?? 3333),
  SUPABASE_URL: req("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: req("SUPABASE_SERVICE_ROLE_KEY"),
  SUPABASE_BUCKET: process.env.SUPABASE_BUCKET ?? "occurrence-evidences",
  SIGNED_URL_TTL_SECONDS: Number(
    process.env.SUPABASE_SIGNED_URL_TTL_SECONDS ?? 3600,
  ),
};
