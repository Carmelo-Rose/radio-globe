import type { Station } from "./stations";

function haversineKm(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 找到离地图中心最近的电台。maxKm 阈值避免选中地球背面的点。
export function nearestStation(
  stations: Station[],
  centerLng: number,
  centerLat: number,
  maxKm = 4000
): Station | null {
  let best: Station | null = null;
  let bestKm = Infinity;
  for (const s of stations) {
    const km = haversineKm(centerLng, centerLat, s.lng, s.lat);
    if (km < bestKm) {
      bestKm = km;
      best = s;
    }
  }
  return best && bestKm <= maxKm ? best : null;
}
