"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useRadio } from "@/lib/store";

const PAGE_SIZE = 100;

export default function StationList() {
  const showList = useRadio((s) => s.showList);
  const setShowList = useRadio((s) => s.setShowList);
  const setCurrent = useRadio((s) => s.setCurrent);
  const currentStationId = useRadio((s) => s.currentStationId);
  const favorites = useRadio((s) => s.favorites);
  const stations = useRadio((s) => s.stations);
  const stationMap = useRadio((s) => s.stationMap);
  const recentStationIds = useRadio((s) => s.recentStationIds);
  const listFilter = useRadio((s) => s.listFilter);
  const favoritesOnly = listFilter === "favorites";

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = useMemo(() => {
    const q = debounced.toLowerCase().trim();
    let list = favoritesOnly ? stations.filter((s) => favorites.has(s.id)) : stations;
    if (q) {
      list = stations.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          s.country.toLowerCase().includes(q) ||
          s.genre.toLowerCase().includes(q)
      );
    }
    // Sort: favorites first, then by name
    return [...list].sort((a, b) => {
      const fa = favorites.has(a.id) ? 0 : 1;
      const fb = favorites.has(b.id) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return a.name.localeCompare(b.name);
    });
  }, [stations, favorites, debounced, favoritesOnly]);

  const visible = filtered.slice(0, PAGE_SIZE);
  const hasMore = filtered.length > PAGE_SIZE;

  // 最近收听：仅在「所有电台」视图、未搜索时显示。按 recentStationIds 顺序解析出存在的台。
  const recentStations = useMemo(() => {
    if (favoritesOnly || debounced) return [];
    return recentStationIds
      .map((id) => stationMap.get(id))
      .filter((s): s is NonNullable<typeof s> => s != null);
  }, [recentStationIds, stationMap, favoritesOnly, debounced]);

  const handleSelect = useCallback(
    (id: string) => {
      setCurrent(id, "select");
      setShowList(false);
    },
    [setCurrent, setShowList]
  );

  if (!showList) return null;

  return (
    <>
      <div className="list-overlay" onClick={() => setShowList(false)} />
      <div className="card list-panel">
        <button className="list-close" onClick={() => setShowList(false)} aria-label="关闭">
          ×
        </button>
        <h2>{favoritesOnly ? "我的收藏" : "所有电台"}</h2>
        <div className="sub">
          {favoritesOnly
            ? `${favorites.size} 个收藏 · ${debounced ? `过滤 ${filtered.length} 个` : "搜索已收藏的电台"}`
            : `共 ${stations.length} 个 · ${debounced ? `过滤 ${filtered.length} 个` : "搜索电台名/城市/国家"}`}
        </div>
        <input
          className="list-search"
          type="text"
          placeholder={favoritesOnly ? "搜索收藏..." : "搜索电台..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="list-scroll">
          {recentStations.length > 0 && (
            <>
              <div className="list-section">最近收听</div>
              {recentStations.map((s) => (
                <button
                  key={`recent-${s.id}`}
                  className={`list-item${s.id === currentStationId ? " active" : ""}`}
                  onClick={() => handleSelect(s.id)}
                >
                  <span>
                    <span className="li-name">{s.name}</span>
                    <span className="li-city">
                      {s.city} · {s.country} · {s.genre}
                    </span>
                  </span>
                  {favorites.has(s.id) && <span className="li-star">★</span>}
                </button>
              ))}
              <div className="list-section">全部电台</div>
            </>
          )}
          {visible.map((s) => (
            <button
              key={s.id}
              className={`list-item${s.id === currentStationId ? " active" : ""}`}
              onClick={() => handleSelect(s.id)}
            >
              <span>
                <span className="li-name">{s.name}</span>
                <span className="li-city">
                  {s.city} · {s.country} · {s.genre}
                </span>
              </span>
              {favorites.has(s.id) && <span className="li-star">★</span>}
            </button>
          ))}
          {hasMore && (
            <div className="list-more">还有 {filtered.length - PAGE_SIZE} 个电台，请搜索缩小范围</div>
          )}
          {filtered.length === 0 && debounced && (
            <div className="list-more">没有找到匹配的电台</div>
          )}
          {filtered.length === 0 && !debounced && favoritesOnly && (
            <div className="list-more">还没有收藏电台 · 点♡即可收藏</div>
          )}
        </div>
      </div>
    </>
  );
}
