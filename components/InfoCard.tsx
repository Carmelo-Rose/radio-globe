"use client";

import { useEffect, useState } from "react";
import { useRadio } from "@/lib/store";

export default function InfoCard() {
  const currentId = useRadio((s) => s.currentStationId);
  const setShowList = useRadio((s) => s.setShowList);
  const station = useRadio((s) => s.stationMap.get(s.currentStationId ?? ""));

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time =
    now && station
      ? new Intl.DateTimeFormat("zh-CN", {
          timeZone: station.timeZone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(now)
      : "--:--:--";

  return (
    <div className="card info-card">
      <div>
        <div className="city">{station?.city ?? "旋转地球"}</div>
        <div className="country">{station?.country ?? "探索电台"}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <div className="time">{time}</div>
          <div className="time-label">当地时间</div>
        </div>
        <button className="all-btn" onClick={() => setShowList(true)}>
          所有电台
        </button>
      </div>
    </div>
  );
}
