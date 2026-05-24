import type { Station } from "./stations";

export type ApiStation = {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  country: string;
  countrycode: string;
  state: string;
  tags: string;
  favicon: string;
  geo_lat: number | null;
  geo_long: number | null;
  codec: string;
  bitrate: number;
  hls: 0 | 1;
  lastcheckok: 0 | 1;
};

// ---------- Server discovery ----------

let servers: string[] = [];
let serverIdx = 0;

async function resolveServers(): Promise<string[]> {
  if (servers.length > 0) return servers;
  try {
    const res = await fetch("https://all.api.radio-browser.info/json/servers");
    // 该端点返回 { ip, name }，没有 url 字段，需用 name 拼出 https 地址
    const data: { name: string }[] = await res.json();
    const names = Array.from(
      new Set(data.map((s) => s.name).filter(Boolean))
    );
    servers = names.map((n) => `https://${n}`);
    // shuffle
    for (let i = servers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [servers[i], servers[j]] = [servers[j], servers[i]];
    }
    serverIdx = 0;
  } catch {
    /* 解析失败时回退到默认服务器 */
  }
  if (servers.length === 0) servers = ["https://de1.api.radio-browser.info"];
  return servers;
}

function nextServer(): string {
  const s = servers[serverIdx % servers.length];
  serverIdx++;
  return s;
}

// ---------- Fetch all stations (progressive) ----------

const STATION_FILTER = (s: ApiStation) =>
  s.lastcheckok === 1 &&
  s.geo_lat != null &&
  s.geo_long != null &&
  (s.url_resolved || s.url);

export async function fetchAllStations(): Promise<ApiStation[]> {
  const pages: ApiStation[][] = [];
  for await (const page of fetchAllStationsPages()) {
    pages.push(page);
  }
  return pages.flat();
}

/** Async generator: yields one filtered page at a time for progressive rendering */
export async function* fetchAllStationsPages(): AsyncGenerator<ApiStation[]> {
  await resolveServers();

  const PAGE = 10000;

  for (let offset = 0; ; offset += PAGE) {
    const params = new URLSearchParams({
      limit: String(PAGE),
      offset: String(offset),
      hidebroken: "true",
      order: "clickcount",
      reverse: "true",
    });

    let page: ApiStation[] | null = null;
    for (let attempt = 0; attempt < Math.min(3, servers.length); attempt++) {
      const base = nextServer();
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 15000);
        const res = await fetch(`${base}/json/stations/search?${params}`, {
          headers: { "User-Agent": "RadioGlobe/0.1" },
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) continue;
        page = await res.json();
        break;
      } catch {
        continue;
      }
    }
    if (!page || page.length === 0) break;
    yield page.filter(STATION_FILTER);
    if (page.length < PAGE) break;
    await new Promise((r) => setTimeout(r, 100));
  }
}

// ---------- Fetch nearby stations ----------

export async function fetchStationsNearby(
  lat: number,
  lng: number,
  distance = 50,
  limit = 50
): Promise<ApiStation[]> {
  await resolveServers();

  const params = new URLSearchParams({
    geo_lat: String(lat),
    geo_long: String(lng),
    // radio-browser 的地理筛选参数是 geo_distance，单位为米；入参 distance 视作公里
    geo_distance: String(Math.round(distance * 1000)),
    limit: String(limit),
    hidebroken: "true",
    order: "clickcount",
    reverse: "true",
  });

  // try up to 3 servers
  for (let attempt = 0; attempt < Math.min(3, servers.length); attempt++) {
    const base = nextServer();
    try {
      const res = await fetch(`${base}/json/stations/search?${params}`);
      if (!res.ok) continue;
      const data: ApiStation[] = await res.json();
      return data.filter(
        (s) =>
          s.lastcheckok === 1 &&
          s.geo_lat != null &&
          s.geo_long != null &&
          (s.url_resolved || s.url)
      );
    } catch {
      continue;
    }
  }
  return [];
}

// ---------- Timezone approximation ----------

const TZ_RULES: { minLng: number; maxLng: number; tz: string }[] = [
  { minLng: -180, maxLng: -157.5, tz: "Pacific/Honolulu" },
  { minLng: -157.5, maxLng: -127.5, tz: "America/Los_Angeles" },
  { minLng: -127.5, maxLng: -105, tz: "America/Denver" },
  { minLng: -105, maxLng: -82.5, tz: "America/Chicago" },
  { minLng: -82.5, maxLng: -52.5, tz: "America/New_York" },
  { minLng: -52.5, maxLng: -30, tz: "America/Sao_Paulo" },
  { minLng: -30, maxLng: 7.5, tz: "Europe/London" },
  { minLng: 7.5, maxLng: 22.5, tz: "Europe/Berlin" },
  { minLng: 22.5, maxLng: 37.5, tz: "Europe/Moscow" },
  { minLng: 37.5, maxLng: 52.5, tz: "Asia/Tehran" },
  { minLng: 52.5, maxLng: 67.5, tz: "Asia/Kabul" },
  { minLng: 67.5, maxLng: 82.5, tz: "Asia/Karachi" },
  { minLng: 82.5, maxLng: 90, tz: "Asia/Kolkata" },
  { minLng: 90, maxLng: 105, tz: "Asia/Bangkok" },
  { minLng: 105, maxLng: 120, tz: "Asia/Shanghai" },
  { minLng: 120, maxLng: 135, tz: "Asia/Tokyo" },
  { minLng: 135, maxLng: 150, tz: "Australia/Sydney" },
  { minLng: 150, maxLng: 180, tz: "Pacific/Auckland" },
];

function guessTimezone(lat: number, lng: number): string {
  if (lat < -60) return "America/Sao_Paulo";
  if (lat > 72) return "Europe/London";
  for (const r of TZ_RULES) {
    if (lng >= r.minLng && lng < r.maxLng) return r.tz;
  }
  return "UTC";
}

// ---------- Mapper ----------

export function toStation(api: ApiStation): Station {
  const tags = api.tags
    ? api.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  return {
    id: api.stationuuid,
    name: api.name,
    city: api.state || api.countrycode || "未知",
    country: api.country || api.countrycode || "未知",
    lng: api.geo_long ?? 0,
    lat: api.geo_lat ?? 0,
    timeZone: guessTimezone(api.geo_lat ?? 0, api.geo_long ?? 0),
    genre: tags.slice(0, 2).join(", ") || "未知",
    streamUrl: api.url_resolved || api.url,
  };
}
