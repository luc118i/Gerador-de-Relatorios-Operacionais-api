import { parseDateTime } from "./parse-duration.js";

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  if (m > 0 && s > 0) return `${m}min ${s}s`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}

export function formatDatetime(dtStr: string): string {
  if (!dtStr || dtStr.trim() === "") return "—";
  const d = parseDateTime(dtStr);
  if (!d) return dtStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${min}`;
}

export function formatDatetimeFull(dtStr: string): string {
  if (!dtStr || dtStr.trim() === "") return "—";
  const d = parseDateTime(dtStr);
  if (!d) return dtStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export function extractDate(dtStr: string): string {
  if (!dtStr) return "—";
  const d = parseDateTime(dtStr);
  if (!d) return dtStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function toMinutes(seconds: number): number {
  return Math.round((seconds / 60) * 10) / 10;
}
