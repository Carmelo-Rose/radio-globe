"use client";

import { useRadio } from "@/lib/store";

export default function StationList() {
  const { showList, setShowList, setCurrent, currentStationId, favorites, stations } = useRadio();
  if (!showList) return null;

  const sorted = [...stations].sort((a, b) => {
    const fa = favorites.has(a.id) ? 0 : 1;
    const fb = favorites.has(b.id) ? 0 : 1;
    return fa - fb;
  });

  return (
    <>
      <div className="list-overlay" onClick={() => setShowList(false)} />
      <div className="card list-panel">
        <button className="list-close" onClick={() => setShowList(false)} aria-label="关闭">
          ×
        </button>
        <h2>所有电台</h2>
        <div className="sub">共 {stations.length} 个 · 点击飞往该电台</div>
        <div className="list-scroll">
          {sorted.map((s) => (
            <button
              key={s.id}
              className={`list-item${s.id === currentStationId ? " active" : ""}`}
              onClick={() => {
                setCurrent(s.id, "select");
                setShowList(false);
              }}
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
        </div>
      </div>
    </>
  );
}
