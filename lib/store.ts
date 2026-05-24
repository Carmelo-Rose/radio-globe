import { create } from "zustand";
import type { Station } from "./stations";
import { fetchStationsNearby, toStation } from "./radioApi";

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
  loadStations: (lat: number, lng: number, distance: number) => Promise<void>;
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
    if (id === get().currentStationId) return;
    set({ currentStationId: id, lastChange: source, playbackError: null });
  },

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  next: () => {
    const { stations, currentStationId } = get();
    if (stations.length === 0) return;
    const i = stations.findIndex((s) => s.id === currentStationId);
    const nextStation = stations[(i + 1) % stations.length];
    set({ currentStationId: nextStation.id, lastChange: "select", playbackError: null });
  },

  prev: () => {
    const { stations, currentStationId } = get();
    if (stations.length === 0) return;
    const i = stations.findIndex((s) => s.id === currentStationId);
    const prevStation = stations[(i - 1 + stations.length) % stations.length];
    set({ currentStationId: prevStation.id, lastChange: "select", playbackError: null });
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

  loadStations: async (lat, lng, distance) => {
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      const apiStations = await fetchStationsNearby(lat, lng, distance, 50);
      const newStations = apiStations.map(toStation);

      set((prev) => {
        const merged = new Map(prev.stationMap);
        for (const s of newStations) {
          if (!merged.has(s.id)) merged.set(s.id, s);
        }
        const stations = Array.from(merged.values());
        const stationMap = merged;

        // Auto-select nearest if nothing selected
        let currentStationId = prev.currentStationId;
        if (!currentStationId && stations.length > 0) {
          currentStationId = stations[0].id;
        }

        return { stations, stationMap, isLoading: false, currentStationId };
      });
    } catch {
      set({ isLoading: false });
    }
  },
}));

// Persist favorites to localStorage
if (typeof window !== "undefined") {
  useRadio.subscribe(
    (state) => state.favorites,
    (favorites) => {
      localStorage.setItem("radio_favorites", JSON.stringify([...favorites]));
    }
  );
}
