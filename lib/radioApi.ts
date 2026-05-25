import type { Station } from "./stations";
import {
  matchCity,
  matchProvince,
  isNationalStation,
  nationalCenter,
  fallbackCity,
  cityJitter,
} from "./cnGeo";

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

// Streams confirmed dead, requiring auth, or proxy-incompatible
const BLOCKED_URL_PATTERNS = [
  "icecast.vrtcdn.be",       // Belgium VRT icecast server down
  "stream.khz.se",           // Sweden khz.se requires auth (401)
  "67.249.184.45:8015",      // Hard Rock Radio FM - returns HTML
  "rocket.streamradio.fr",   // AAAudio Luxembourg - 502
  "minimw.imbc.com",         // MBC FM Korea - token expired (400)
  "ice5.somafm.com",         // SomaFM - proxy incompatible
];

const BLOCKED_STATION_NAMES = new Set([
  "Gagasi FM", // South Africa - 404
]);

const STATION_FILTER = (s: ApiStation) =>
  s.lastcheckok === 1 &&
  s.geo_lat != null &&
  s.geo_long != null &&
  (s.url_resolved || s.url) &&
  !BLOCKED_URL_PATTERNS.some((p) => (s.url_resolved || s.url).includes(p)) &&
  !BLOCKED_STATION_NAMES.has(s.name);

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

  // 分页设小一些：国内移动网络拉 radio-browser（服务器在欧美）时，
  // 一万条/页的大包常超时导致全球数据加载失败、地图只剩中国台。
  // 5000 条/页让每页更快返回，配合更长超时与更多重试更稳。
  const PAGE = 5000;

  for (let offset = 0; ; offset += PAGE) {
    const params = new URLSearchParams({
      limit: String(PAGE),
      offset: String(offset),
      hidebroken: "true",
      order: "clickcount",
      reverse: "true",
    });

    let page: ApiStation[] | null = null;
    for (let attempt = 0; attempt < Math.min(4, servers.length); attempt++) {
      const base = nextServer();
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 30000);
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

// ---------- Fetch China stations (real, with city geo) ----------

/**
 * 拉取中国电台（流均经 hidebroken 校验可播放），并用台名里的城市补真实坐标。
 * radio-browser 的中国台大多没有 geo/state，所以靠"台名含城市"匹配 CN_CITIES。
 * 已自带坐标的台则直接用其真实坐标。
 */
export async function fetchChinaStations(): Promise<Station[]> {
  await resolveServers();

  const params = new URLSearchParams({
    countrycode: "CN",
    hidebroken: "true",
    order: "clickcount",
    reverse: "true",
    limit: "1000",
  });

  let data: ApiStation[] = [];
  for (let attempt = 0; attempt < Math.min(3, servers.length); attempt++) {
    const base = nextServer();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(`${base}/json/stations/search?${params}`, {
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      data = await res.json();
      break;
    } catch {
      continue;
    }
  }

  const out: Station[] = [];
  for (const s of data) {
    if (s.lastcheckok !== 1) continue;
    const stream = s.url_resolved || s.url;
    if (!stream) continue;

    let lng: number;
    let lat: number;
    let city: string;

    if (s.geo_lat != null && s.geo_long != null) {
      // 自带真实坐标
      lng = s.geo_long;
      lat = s.geo_lat;
      city = s.state || "中国";
    } else {
      // 依次尝试：城市名 -> 省份(省会) -> 全国性台(北京) -> 兜底散布到真实城市
      const m =
        matchCity(s.name) ||
        matchProvince(s.name) ||
        (isNationalStation(s.name) ? nationalCenter() : null) ||
        fallbackCity(s.stationuuid);
      const [dx, dy] = cityJitter(s.stationuuid);
      lng = m.lng + dx;
      lat = m.lat + dy;
      city = m.city;
    }

    const tags = s.tags
      ? s.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];
    out.push({
      id: s.stationuuid,
      name: s.name,
      city,
      country: "中国",
      lng,
      lat,
      timeZone: "Asia/Shanghai",
      genre: tags.slice(0, 2).join(", ") || "综合",
      streamUrl: stream,
    });
  }
  return out;
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
