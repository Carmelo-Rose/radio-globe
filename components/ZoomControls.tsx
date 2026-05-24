"use client";

import { mapBridge } from "@/lib/mapBridge";

export default function ZoomControls() {
  return (
    <div className="card zoom">
      <button onClick={() => mapBridge.map?.zoomIn()} aria-label="放大" title="放大">
        +
      </button>
      <button onClick={() => mapBridge.map?.zoomOut()} aria-label="缩小" title="缩小">
        −
      </button>
    </div>
  );
}
