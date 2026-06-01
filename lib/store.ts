import { create } from "zustand";
import { GLOBAL_FALLBACK_STATIONS } from "./globalFallbackStations";
import { BOOTSTRAP_STATIONS, type Station } from "./stations";
import { fetchAllStationsPages, fetchChinaStations, toStation, isBlockedStream } from "./radioApi";
import { filterHiddenChinaStations, isChinaRadioStationHidden } from "./chinaRadioHealth";

const CACHE_KEY = "radio_stations_cache";
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
const RECENT_KEY = "radio_recent";
const RECENT_LIMIT = 20;

type RadioState = {
  currentStationId: string | null;
  hasStarted: boolean;
  isPlaying: boolean;
  volume: number;
  favorites: Set<string>;
  showList: boolean;
  listFilter: "all" | "favorites";
  lastChange: "tune" | "select";

  stations: Station[];
  stationMap: Map<string, Station>;
  isLoading: boolean;
  isCached: boolean;
  // 是否已加载到真实电台数据（缓存/接口）。为 false 时只有 bootstrap 兜底台，
  // UI 据此显示"加载中…"而非误导性的"4 STATIONS"。
  hasRealData: boolean;
  loadProgress: string;
  playbackError: PlaybackError | null;
  isPinned: boolean;
  // 睡眠定时器：到点自动停止播放。sleepUntil 为目标时间戳(ms)，null 表示未设置。
  sleepUntil: number | null;
  // 最近收听：电台 id 列表，最近在前，去重，上限 RECENT_LIMIT。
  recentStationIds: string[];

  setCurrent: (id: string | null, source: "tune" | "select") => void;
  seedBootstrapStations: () => void;
  start: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  toggleFavorite: (id: string) => void;
  setVolume: (v: number) => void;
  setShowList: (open: boolean) => void;
  openList: (filter: "all" | "favorites") => void;
  fetchAll: () => Promise<void>;
  getStation: (id: string) => Station | undefined;
  setPlaybackError: (msg: PlaybackError | null) => void;
  togglePin: () => void;
  // 设置/取消睡眠定时器。minutes 为分钟数，传 0 或 null 取消。
  setSleepTimer: (minutes: number | null) => void;
};

type PlaybackError = {
  type: "offline" | "error";
  message: string;
};

// ---------- IndexedDB cache ----------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("RadioGlobe", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("cache");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadCachedStations(): Promise<Station[] | null> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    return await new Promise((resolve) => {
      const tx = db!.transaction("cache", "readonly");
      const store = tx.objectStore("cache");
      const req = store.get(CACHE_KEY);
      req.onsuccess = () => {
        const entry = req.result as { data: Station[]; ts: number } | undefined;
        if (entry && Date.now() - entry.ts < CACHE_TTL) {
          resolve(entry.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

async function saveCachedStations(stations: Station[]): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    const tx = db.transaction("cache", "readwrite");
    tx.objectStore("cache").put({ data: stations, ts: Date.now() }, CACHE_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  } finally {
    db?.close();
  }
}

// ---------- Hydrate favorites ----------

function loadFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem("radio_favorites");
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter(
        (v): v is string => typeof v === "string" && !isChinaRadioStationHidden(v)
      )
    );
  } catch {
    return new Set();
  }
}

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string" && !isChinaRadioStationHidden(v))
      .slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

// 把一个台 id 推入最近列表（去重、置顶、截断）。返回新数组。
function pushRecent(list: string[], id: string): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, RECENT_LIMIT);
}

// ---------- Store ----------

function applyStations(prev: RadioState, stations: Station[]): Partial<RadioState> {
  const stationMap = new Map(stations.map((s) => [s.id, s]));
  let currentStationId = prev.currentStationId;
  if (currentStationId && !stationMap.has(currentStationId)) {
    currentStationId = null;
  }
  return { stations, stationMap, currentStationId };
}

function isNonBuiltinChinaStation(s: Station): boolean {
  return (s.country === "China" || s.country === "中国") && !s.id.startsWith("cn-0472-");
}

function seedBootstrapPatch(prev: RadioState): Partial<RadioState> {
  const merged = new Map(prev.stationMap);
  for (const station of BOOTSTRAP_STATIONS) merged.set(station.id, station);
  const stations = Array.from(merged.values());
  let currentStationId = prev.currentStationId;
  const currentStation = currentStationId ? merged.get(currentStationId) : undefined;
  if (!currentStation?.streamUrl) {
    currentStationId = BOOTSTRAP_STATIONS[0]?.id ?? null;
  }

  return {
    ...applyStations({ ...prev, currentStationId }, stations),
    currentStationId,
    isPlaying: prev.isPlaying || (prev.hasStarted && Boolean(currentStationId)),
    isCached: prev.hasRealData ? prev.isCached : true,
  };
}

function seedGlobalFallbackPatch(prev: RadioState): Partial<RadioState> {
  const merged = new Map(prev.stationMap);
  for (const station of GLOBAL_FALLBACK_STATIONS) {
    if (!merged.has(station.id)) merged.set(station.id, station);
  }
  const stations = Array.from(merged.values());

  return {
    ...applyStations(prev, stations),
    hasRealData: true,
    loadProgress: `已加载 ${stations.length} 个内置全球电台，正在更新...`,
  };
}

// 睡眠定时器句柄（module 级，跨 set 调用持有）。
let sleepTimerHandle: ReturnType<typeof setTimeout> | null = null;

export const useRadio = create<RadioState>((set, get) => ({
  currentStationId: null,
  hasStarted: false,
  isPlaying: false,
  volume: 0.8,
  favorites: loadFavorites(),
  showList: false,
  listFilter: "all",
  lastChange: "select",

  stations: [],
  stationMap: new Map(),
  isLoading: false,
  isCached: false,
  hasRealData: false,
  loadProgress: "",
  playbackError: null,
  isPinned: false,
  sleepUntil: null,
  recentStationIds: loadRecent(),

  setCurrent: (id, source) => {
    const prev = get();
    if (id === prev.currentStationId) {
      if (!prev.hasStarted) {
        set({ lastChange: source, playbackError: null });
        return;
      }
      set({ isPlaying: false, lastChange: source, playbackError: null });
      setTimeout(() => {
        if (get().hasStarted) set({ isPlaying: true });
      }, 50);
      return;
    }
    set({
      currentStationId: id,
      lastChange: source,
      isPlaying: prev.hasStarted,
      playbackError: null,
      recentStationIds: id ? pushRecent(prev.recentStationIds, id) : prev.recentStationIds,
    });
  },

  seedBootstrapStations: () => {
    set((prev) => seedBootstrapPatch(prev));
  },

  start: () => {
    set((prev) => {
      const currentStation = prev.currentStationId
        ? prev.stationMap.get(prev.currentStationId)
        : undefined;
      const patch = currentStation?.streamUrl ? {} : seedBootstrapPatch(prev);
      const currentStationId = (patch.currentStationId ?? prev.currentStationId) as string | null;
      const stationMap = (patch.stationMap ?? prev.stationMap) as Map<string, Station>;
      return {
        ...patch,
        hasStarted: true,
        isPlaying: Boolean(currentStationId && stationMap.get(currentStationId)?.streamUrl),
        playbackError: null,
        // 落地兜底台由 bootstrap 直接设定、未经 setCurrent，这里补记一次到最近收听。
        recentStationIds: currentStationId
          ? pushRecent(prev.recentStationIds, currentStationId)
          : prev.recentStationIds,
      };
    });
  },

  togglePlay: () => {
    if (!get().currentStationId) return;
    set((s) => {
      const next = !s.isPlaying;
      return { isPlaying: next, playbackError: next ? s.playbackError : null };
    });
  },

  next: () => {
    const { stations, currentStationId } = get();
    if (stations.length === 0) return;
    const i = stations.findIndex((s) => s.id === currentStationId);
    const nextIdx = i < 0 ? 0 : (i + 1) % stations.length;
    const id = stations[nextIdx].id;
    if (id === currentStationId) return;
    set((s) => ({
      currentStationId: id,
      lastChange: "select",
      hasStarted: true,
      isPlaying: true,
      playbackError: null,
      recentStationIds: pushRecent(s.recentStationIds, id),
    }));
  },

  prev: () => {
    const { stations, currentStationId } = get();
    if (stations.length === 0) return;
    const i = stations.findIndex((s) => s.id === currentStationId);
    const prevIdx = i < 0 ? stations.length - 1 : (i - 1 + stations.length) % stations.length;
    const id = stations[prevIdx].id;
    if (id === currentStationId) return;
    set((s) => ({
      currentStationId: id,
      lastChange: "select",
      hasStarted: true,
      isPlaying: true,
      playbackError: null,
      recentStationIds: pushRecent(s.recentStationIds, id),
    }));
  },

  toggleFavorite: (id) =>
    set((s) => {
      const next = new Set(s.favorites);
      next.has(id) ? next.delete(id) : next.add(id);
      return { favorites: next };
    }),

  setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)) }),
  setShowList: (open) => set({ showList: open }),
  openList: (filter) => set({ showList: true, listFilter: filter }),

  getStation: (id) => get().stationMap.get(id),

  setPlaybackError: (msg) => set({ playbackError: msg }),

  togglePin: () => set((s) => ({ isPinned: !s.isPinned })),

  setSleepTimer: (minutes) => {
    if (sleepTimerHandle) {
      clearTimeout(sleepTimerHandle);
      sleepTimerHandle = null;
    }
    if (!minutes || minutes <= 0) {
      set({ sleepUntil: null });
      return;
    }
    const until = Date.now() + minutes * 60 * 1000;
    set({ sleepUntil: until });
    sleepTimerHandle = setTimeout(() => {
      sleepTimerHandle = null;
      set({ sleepUntil: null, isPlaying: false });
    }, minutes * 60 * 1000);
  },

  fetchAll: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, loadProgress: "加载中..." });

    // 冷启动兜底：真机网络拉 radio-browser 可能较慢甚至失败。
    // 先放入少量确认可播的内置台，保证用户点开始后立刻有声源。
    if (get().stations.length === 0) {
      set((prev) => {
        return {
          ...seedBootstrapPatch(prev),
          loadProgress: "正在更新电台列表...",
        };
      });
    }

    // 1. Load cached data first (instant)。过滤黑名单：旧缓存可能含已拉黑的死台，
    // 且合并逻辑只增不删，不在此剔除会让死台随缓存永久留存。
    const cachedRaw = await loadCachedStations();
    const cached =
      cachedRaw
        ? filterHiddenChinaStations(
            cachedRaw.filter(
              (s) => !isNonBuiltinChinaStation(s) && !(s.streamUrl && isBlockedStream(s.streamUrl))
            )
          )
        : null;
    // 合并而非替换：bootstrap 兜底台已先占位（stations.length>0），
    // 不能再用 length===0 拦截，否则缓存的几千个台永远加载不进来、地球只剩几颗点。
    if (cached && cached.length > 0) {
      set((prev) => {
        const merged = new Map(prev.stationMap);
        for (const s of cached) merged.set(s.id, s);
        const stations = Array.from(merged.values());
        return {
          ...applyStations(prev, stations),
          isCached: true,
          hasRealData: true,
          loadProgress: `已加载 ${stations.length} 个缓存电台`,
        };
      });
    }

    // radio-browser sits outside mainland China and often times out on mobile
    // networks. Seed a compact global snapshot so native builds never collapse
    // to China-only dots while the live API is retrying or unavailable.
    set((prev) => seedGlobalFallbackPatch(prev));

    // 2. Fetch fresh data progressively
    try {
      const allStations: Station[] = [];
      let pageCount = 0;

      // 2a. 先补充中国电台（真实城市定位 + 可播放流），让中国区域立刻变密
      try {
        const cn = await fetchChinaStations();
        if (cn.length > 0) {
          allStations.push(...cn);
          set((prev) => {
            const merged = new Map(prev.stationMap);
            for (const s of cn) merged.set(s.id, s);
            const stations = Array.from(merged.values());
            return {
              ...applyStations(prev, stations),
              isCached: false,
              hasRealData: true,
              loadProgress: `已加载 ${stations.length} 个电台...`,
            };
          });
        }
      } catch {
        /* 中国数据失败不影响全球加载 */
      }

      for await (const page of fetchAllStationsPages()) {
        pageCount++;
        const newStations = page.map(toStation);
        allStations.push(...newStations);

        // Update store with cumulative data (merge with existing)
        set((prev) => {
          const merged = new Map(prev.stationMap);
          for (const s of newStations) {
            if (!merged.has(s.id)) merged.set(s.id, s);
          }
          const stations = Array.from(merged.values());
          return {
            ...applyStations(prev, stations),
            isCached: false,
            hasRealData: true,
            loadProgress: `已加载 ${stations.length} 个电台...`,
          };
        });
      }

      // 3. Cache the result
      if (allStations.length > 0) {
        const finalStations = get().stations;
        saveCachedStations(finalStations);
      }

      set({ isLoading: false, loadProgress: "" });
    } catch {
      set((s) => ({
        isLoading: false,
        loadProgress: s.stations.length > 0 ? "" : "加载失败，请刷新重试",
      }));
    }
  },
}));

// Persist favorites to localStorage
if (typeof window !== "undefined") {
  let prevFavs = useRadio.getState().favorites;
  let prevRecent = useRadio.getState().recentStationIds;
  useRadio.subscribe((state) => {
    if (state.favorites !== prevFavs) {
      prevFavs = state.favorites;
      try {
        localStorage.setItem("radio_favorites", JSON.stringify([...state.favorites]));
      } catch {
        // QuotaExceededError — ignore
      }
    }
    if (state.recentStationIds !== prevRecent) {
      prevRecent = state.recentStationIds;
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(state.recentStationIds));
      } catch {
        // QuotaExceededError — ignore
      }
    }
  });
}
