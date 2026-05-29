export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function getBoundingBox(points: Array<{ lat: number; lng: number }>): BoundingBox | null {
  const valid = points.filter(
    (p) => p?.lat != null && p?.lng != null && !isNaN(p.lat) && !isNaN(p.lng) && p.lat !== 0 && p.lng !== 0,
  );

  if (valid.length === 0) return null;

  if (valid.length === 1) {
    const p = valid[0]!;
    return { north: p.lat + 0.05, south: p.lat - 0.05, east: p.lng + 0.05, west: p.lng - 0.05 };
  }

  let north = -Infinity;
  let south = Infinity;
  let east = -Infinity;
  let west = Infinity;

  for (const p of valid) {
    if (p.lat > north) north = p.lat;
    if (p.lat < south) south = p.lat;
    if (p.lng > east) east = p.lng;
    if (p.lng < west) west = p.lng;
  }

  const latPad = (north - south) * 0.05;
  const lngPad = (east - west) * 0.05;

  return {
    north: north + latPad,
    south: south - latPad,
    east: east + lngPad,
    west: west - lngPad,
  };
}
