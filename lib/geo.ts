import type { Station } from "./stations";

export function haversineKm(aLng: number, aLat: number, bLng: number, bLat: number): number {
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

export type NearbyStation = Station & { km: number };

// 返回离给定坐标最近的若干电台（不含 excludeId），按距离升序。
export function nearbyStations(
  stations: Station[],
  centerLng: number,
  centerLat: number,
  limit = 6,
  excludeId?: string
): NearbyStation[] {
  const scored: NearbyStation[] = [];
  for (const s of stations) {
    if (s.id === excludeId) continue;
    const km = haversineKm(centerLng, centerLat, s.lng, s.lat);
    scored.push({ ...s, km });
  }
  scored.sort((a, b) => a.km - b.km);
  return scored.slice(0, limit);
}
