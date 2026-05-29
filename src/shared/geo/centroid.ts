export interface GeoPoint {
  lat: number;
  lng: number;
}

const BRASILIA_FALLBACK: GeoPoint = { lat: -15.7801, lng: -47.9292 };

export function getCenter(points: GeoPoint[]): GeoPoint {
  const valid = points.filter((p) => p?.lat && p?.lng);
  if (valid.length === 0) return BRASILIA_FALLBACK;
  const lat = valid.reduce((sum, p) => sum + p.lat, 0) / valid.length;
  const lng = valid.reduce((sum, p) => sum + p.lng, 0) / valid.length;
  return { lat, lng };
}

export function extractRoutePoints<T extends { lat?: number | null; lng?: number | null; seq?: number; ponto?: string }>(
  points: T[],
): Array<GeoPoint & { seq?: number; ponto?: string }> {
  return points
    .filter((p) => p.lat && p.lng && !isNaN(p.lat!) && !isNaN(p.lng!))
    .map((p) => ({
      lat: p.lat!,
      lng: p.lng!,
      ...(p.seq !== undefined && { seq: p.seq }),
      ...(p.ponto !== undefined && { ponto: p.ponto }),
    }));
}
