import { create } from "zustand";
import type { Station } from "./stations";
import { fetchAllStationsPages, toStation } from "./radioApi";

const CACHE_KEY = "radio_stations_cache";
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

type RadioState = {
  currentStationId: string | null;
  isPlaying: boolean;
  volume: number;
  favorites: Set<string>;
  showList: boolean;
  lastChange: "tune" | "select";

  stations: Station[];
  stationMap: Map<string, Station>;
  isLoading: boolean;
  isCached: boolean;
  loadProgress: string;
  playbackError: string | null;

  setCurrent: (id: string | null, source: "tune" | "select") => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  toggleFavorite: (id: string) => void;
  setVolume: (v: number) => void;
  setShowList: (open: boolean) => void;
  fetchAll: () => Promise<void>;
  getStation: (id: string) => Station | undefined;
  setPlaybackError: (msg: string | null) => void;
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
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction("cache", "readonly");
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
  }
}

async function saveCachedStations(stations: Station[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("cache", "readwrite");
    tx.objectStore("cache").put({ data: stations, ts: Date.now() }, CACHE_KEY);
  } catch {
    // ignore
  }
}

// ---------- Hydrate favorites ----------

function loadFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem("radio_favorites");
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

// ---------- Store ----------

function applyStations(prev: RadioState, stations: Station[]): Partial<RadioState> {
  const stationMap = new Map(stations.map((s) => [s.id, s]));
  let currentStationId = prev.currentStationId;
  if (currentStationId && !stationMap.has(currentStationId)) {
    currentStationId = null;
  }
  if (!currentStationId && stations.length > 0) {
    currentStationId = stations[0].id;
  }
  return { stations, stationMap, currentStationId, lastChange: "tune" as const };
}

export const useRadio = create<RadioState>((set, get) => ({
  currentStationId: null,
  isPlaying: false,
  volume: 0.8,
  favorites: loadFavorites(),
  showList: false,
  lastChange: "select",

  stations: [],
  stationMap: new Map(),
  isLoading: false,
  isCached: false,
  loadProgress: "",
  playbackError: null,

  setCurrent: (id, source) => {
    const prev = get();
    if (id === prev.currentStationId) {
      set({ isPlaying: false, playbackError: null });
      setTimeout(() => set({ isPlaying: true }), 50);
      return;
    }
    set({ currentStationId: id, lastChange: source, isPlaying: true, playbackError: null });
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
    set({ currentStationId: id, lastChange: "select", isPlaying: true, playbackError: null });
  },

  prev: () => {
    const { stations, currentStationId } = get();
    if (stations.length === 0) return;
    const i = stations.findIndex((s) => s.id === currentStationId);
    const prevIdx = i < 0 ? stations.length - 1 : (i - 1 + stations.length) % stations.length;
    const id = stations[prevIdx].id;
    if (id === currentStationId) return;
    set({ currentStationId: id, lastChange: "select", isPlaying: true, playbackError: null });
  },

  toggleFavorite: (id) =>
    set((s) => {
      const next = new Set(s.favorites);
      next.has(id) ? next.delete(id) : next.add(id);
      return { favorites: next };
    }),

  setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)) }),
  setShowList: (open) => set({ showList: open }),

  getStation: (id) => get().stationMap.get(id),

  setPlaybackError: (msg) => set({ playbackError: msg }),

  fetchAll: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, loadProgress: "加载中..." });

    // 1. Load cached data first (instant)
    const cached = await loadCachedStations();
    if (cached && cached.length > 0 && get().stations.length === 0) {
      set((prev) => ({
        ...applyStations(prev, cached),
        isCached: true,
        loadProgress: `已加载 ${cached.length} 个缓存电台`,
      }));
    }

    // 2. Fetch fresh data progressively
    try {
      const allStations: Station[] = [];
      let pageCount = 0;

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
  useRadio.subscribe((state) => {
    if (state.favorites !== prevFavs) {
      prevFavs = state.favorites;
      try {
        localStorage.setItem("radio_favorites", JSON.stringify([...state.favorites]));
      } catch {
        // QuotaExceededError — ignore
      }
    }
  });
}
