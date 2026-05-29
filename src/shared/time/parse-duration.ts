export function parseDateTime(dtStr: string): Date | null {
  if (!dtStr) return null;
  // Suporta "YYYY-MM-DD HH:MM:SS" e "YYYY-MM-DDTHH:MM:SS"
  const clean = dtStr.trim().replace("T", " ");
  const spaceIdx = clean.indexOf(" ");
  if (spaceIdx === -1) return null;

  const datePart = clean.slice(0, spaceIdx);
  const timePart = clean.slice(spaceIdx + 1);

  const dateParts = datePart.split("-");
  const timeParts = timePart.split(":");

  if (dateParts.length !== 3 || timeParts.length < 2) return null;

  return new Date(
    parseInt(dateParts[0] ?? "0", 10),
    parseInt(dateParts[1] ?? "0", 10) - 1,
    parseInt(dateParts[2] ?? "0", 10),
    parseInt(timeParts[0] ?? "0", 10),
    parseInt(timeParts[1] ?? "0", 10),
    parseInt(timeParts[2] ?? "0", 10),
  );
}

export function parseDuration(hhmmss: string): number {
  if (!hhmmss || hhmmss === "-" || hhmmss.trim() === "") return 0;
  const parts = hhmmss.trim().split(":");
  if (parts.length !== 3) return 0;
  const h = parseInt(parts[0] ?? "0", 10) || 0;
  const m = parseInt(parts[1] ?? "0", 10) || 0;
  const s = parseInt(parts[2] ?? "0", 10) || 0;
  return h * 3600 + m * 60 + s;
}
