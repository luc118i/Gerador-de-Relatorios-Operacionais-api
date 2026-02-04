import "dotenv/config";

function req(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const ENV = {
  SUPABASE_URL: req("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: req("SUPABASE_SERVICE_ROLE_KEY"),
  SUPABASE_BUCKET: process.env.SUPABASE_BUCKET ?? "occurrence-evidences",
  PORT: Number(process.env.PORT ?? 3333),
};
