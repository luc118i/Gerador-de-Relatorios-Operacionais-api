import { parseDateTime } from "./parse-duration.js";

export function diffSeconds(dt1Str: string, dt2Str: string): number | null {
  if (!dt1Str || !dt2Str) return null;
  const d1 = parseDateTime(dt1Str);
  const d2 = parseDateTime(dt2Str);
  if (!d1 || !d2) return null;
  return Math.round((d2.getTime() - d1.getTime()) / 1000);
}
