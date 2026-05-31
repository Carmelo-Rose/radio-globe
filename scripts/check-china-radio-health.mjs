import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const DEFAULT_INTERVAL_MS = 8000;
const DEFAULT_CONCURRENCY = 10;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    intervalMs: DEFAULT_INTERVAL_MS,
    concurrency: DEFAULT_CONCURRENCY,
    out: "",
    healthStatus: "",
    limit: 0,
    ids: new Set(),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--interval-ms") opts.intervalMs = Number(args[++i]);
    else if (arg === "--concurrency") opts.concurrency = Number(args[++i]);
    else if (arg === "--out") opts.out = args[++i] ?? "";
    else if (arg === "--health-status") opts.healthStatus = args[++i] ?? "";
    else if (arg === "--limit") opts.limit = Number(args[++i]);
    else if (arg === "--id") opts.ids.add(String(args[++i] ?? ""));
    else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function loadStations() {
  const text = readFileSync("lib/chinaRadioData.ts", "utf8");
  const stations = [];
  const pattern =
    /id: "cn-0472-(\d+)", name: "([^"]+)",.*?streamUrl: "([^"]+)"/g;

  for (const match of text.matchAll(pattern)) {
    stations.push({
      id: `cn-0472-${match[1]}`,
      sourceId: match[1],
      name: match[2],
      streamUrl: match[3],
    });
  }
  return stations;
}

function loadHealthOverrides() {
  const text = readFileSync("lib/chinaRadioHealth.ts", "utf8");
  const overrides = new Map();
  const pattern =
    /"(cn-0472-\d+)": \{\s*status: "([^"]+)",\s*reason: "([^"]+)"/g;

  for (const match of text.matchAll(pattern)) {
    overrides.set(match[1], {
      status: match[2],
      reason: match[3],
    });
  }
  return overrides;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPlaylistState(text) {
  if (!text.startsWith("#EXTM3U")) return null;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const mediaSequence =
    lines
      .find((line) => line.startsWith("#EXT-X-MEDIA-SEQUENCE:"))
      ?.split(":")[1] ?? "";
  const segments = lines.filter((line) => !line.startsWith("#"));
  return {
    mediaSequence,
    segmentCount: segments.length,
    lastSegment: segments[segments.length - 1] ?? "",
  };
}

async function fetchText(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "RadioGlobeHealthCheck/0.1",
        Accept: "*/*",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url,
      contentType: res.headers.get("content-type") ?? "",
      text,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkStation(station, intervalMs) {
  try {
    const first = await fetchText(station.streamUrl);
    if (!first.ok) {
      return {
        ...station,
        status: first.status === 404 ? "no_stream" : "error",
        httpStatus: first.status,
        resolvedUrl: first.finalUrl,
        reason: first.contentType.includes("text/html")
          ? "non-audio html response"
          : "upstream returned non-OK status",
      };
    }

    const firstState = getPlaylistState(first.text);
    if (!firstState) {
      return {
        ...station,
        status: "error",
        httpStatus: first.status,
        resolvedUrl: first.finalUrl,
        reason: "response is not an HLS playlist",
      };
    }

    if (firstState.segmentCount === 0) {
      return {
        ...station,
        status: "no_stream",
        httpStatus: first.status,
        resolvedUrl: first.finalUrl,
        before: firstState,
        reason: "playlist has no media segments",
      };
    }

    await sleep(intervalMs);
    const second = await fetchText(first.finalUrl);
    const secondState = getPlaylistState(second.text);
    if (!second.ok || !secondState) {
      return {
        ...station,
        status: "error",
        httpStatus: second.status,
        resolvedUrl: first.finalUrl,
        before: firstState,
        reason: "second playlist fetch failed",
      };
    }

    const advanced =
      firstState.mediaSequence !== secondState.mediaSequence ||
      firstState.lastSegment !== secondState.lastSegment;

    return {
      ...station,
      status: advanced ? "live" : "frozen",
      httpStatus: second.status,
      resolvedUrl: first.finalUrl,
      before: firstState,
      after: secondState,
      reason: advanced ? "playlist advanced" : "playlist did not advance",
    };
  } catch (error) {
    return {
      ...station,
      status: "error",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runPool(items, concurrency, worker) {
  const results = [];
  let next = 0;
  async function runOne() {
    while (next < items.length) {
      const index = next++;
      const result = await worker(items[index], index);
      results[index] = result;
      const done = results.filter(Boolean).length;
      process.stderr.write(
        `\rchecked ${done}/${items.length} (${result.status}) ${result.name}`
      );
    }
  }
  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, () => runOne())
  );
  process.stderr.write("\n");
  return results;
}

const opts = parseArgs();
let stations = loadStations();
const healthOverrides = loadHealthOverrides();
if (opts.ids.size > 0) {
  stations = stations.filter((station) => opts.ids.has(station.sourceId));
}
if (opts.healthStatus) {
  const statuses = new Set(
    opts.healthStatus
      .split(",")
      .map((status) => status.trim())
      .filter(Boolean)
  );
  stations = stations.filter((station) =>
    statuses.has(healthOverrides.get(station.id)?.status)
  );
}
if (opts.limit > 0) stations = stations.slice(0, opts.limit);

const results = await runPool(stations, opts.concurrency, (station) =>
  checkStation(station, opts.intervalMs)
);

const summary = results.reduce((acc, result) => {
  acc[result.status] = (acc[result.status] ?? 0) + 1;
  return acc;
}, {});

const payload = {
  checkedAt: new Date().toISOString(),
  intervalMs: opts.intervalMs,
  healthStatusFilter: opts.healthStatus || null,
  total: results.length,
  summary,
  results,
};

if (opts.out) {
  mkdirSync(dirname(opts.out), { recursive: true });
  writeFileSync(opts.out, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(opts.out);
} else {
  console.log(JSON.stringify(payload, null, 2));
}
