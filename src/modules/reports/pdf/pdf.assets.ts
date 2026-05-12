// pdf.assets.ts
import fs from "node:fs";
import path from "node:path";

let cachedLogoDataUri: string | null = null;

export function getLogoDataUri(): string | null {
  if (cachedLogoDataUri) return cachedLogoDataUri;

  // Ajuste o caminho para onde você colocar o arquivo (ex.: /src/assets/catedral.png)
  const logoPath = path.resolve(process.cwd(), "src/assets/catedral.png");

  if (!fs.existsSync(logoPath)) return null;

  const buf = fs.readFileSync(logoPath);
  const b64 = buf.toString("base64");

  // PNG (se for JPG, troque para image/jpeg)
  cachedLogoDataUri = `data:image/png;base64,${b64}`;
  return cachedLogoDataUri;
}

let cachedSuspensaoLogoDataUri: string | null = null;

export function getSuspensaoLogoDataUri(): string | null {
  if (cachedSuspensaoLogoDataUri) return cachedSuspensaoLogoDataUri;
  const logoPath = path.resolve(process.cwd(), "src/assets/suspensao-logo.png");
  if (!fs.existsSync(logoPath)) return null;
  const buf = fs.readFileSync(logoPath);
  cachedSuspensaoLogoDataUri = `data:image/png;base64,${buf.toString("base64")}`;
  return cachedSuspensaoLogoDataUri;
}
