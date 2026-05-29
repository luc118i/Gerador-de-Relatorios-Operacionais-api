const R_KM = 6371;

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R_KM * c * 100) / 100;
}

export function totalRouteKm(points: Array<{ lat: number; lng: number }>): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (a.lat && a.lng && b.lat && b.lng) {
      total += haversineKm(a.lat, a.lng, b.lat, b.lng);
    }
  }
  return Math.round(total * 100) / 100;
}
