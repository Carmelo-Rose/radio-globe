import { create } from "zustand";
import type { Station } from "./stations";
import { fetchAllStations, toStation } from "./radioApi";

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

// Hydrate favorites from localStorage
function loadFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem("radio_favorites");
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
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
  playbackError: null,

  setCurrent: (id, source) => {
    const prev = get();
    if (id === prev.currentStationId) {
      // Retry: stop then restart playback
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
    set({ isLoading: true });
    try {
      const apiStations = await fetchAllStations();
      const stations = apiStations.map(toStation);
      const stationMap = new Map(stations.map((s) => [s.id, s]));

      set((prev) => {
        let currentStationId = prev.currentStationId;
        // Validate current station still exists
        if (currentStationId && !stationMap.has(currentStationId)) {
          currentStationId = null;
        }
        if (!currentStationId && stations.length > 0) {
          currentStationId = stations[0].id;
        }
        return { stations, stationMap, isLoading: false, currentStationId, lastChange: "tune" as const };
      });
    } catch {
      set({ isLoading: false });
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
