"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import type { Station } from "@/lib/stations";
import { nearestStation } from "@/lib/geo";
import { useRadio } from "@/lib/store";
import { mapBridge } from "@/lib/mapBridge";

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const RETICLE_RADIUS_PX = 40;
const SNAP_DURATION_MS = 260;

// 中国边界范围 + 渐变过渡带
const CN_BOUNDS = { west: 73, east: 135, south: 18, north: 54 };
const CN_MARGIN = 10; // 过渡带宽度（度）

function chinaBlendFactor(lng: number, lat: number): number {
  // 返回 0~1，1=完全在中国范围内，0=完全在外面
  const { west, east, south, north } = CN_BOUNDS;
  const m = CN_MARGIN;
  const x = Math.min(Math.max((lng - (west - m)) / ((west + m) - (west - m)), 0), 1)
           * (1 - Math.min(Math.max((lng - (east - m)) / ((east + m) - (east - m)), 0), 1));
  const y = Math.min(Math.max((lat - (south - m)) / ((south + m) - (south - m)), 0), 1)
           * (1 - Math.min(Math.max((lat - (north - m)) / ((north + m) - (north - m)), 0), 1));
  // 用更柔和的曲线
  const raw = x * y;
  return raw * raw * (3 - 2 * raw); // smoothstep
}

function updateTileOpacity(map: MlMap) {
  const c = map.getCenter();
  const blend = chinaBlendFactor(c.lng, c.lat);
  // 中国区域内：高德可见，NASA/Esri 隐藏
  // 中国区域外：NASA/Esri 可见，高德隐藏
  // 过渡带：交叉淡入淡出
  try {
    map.setPaintProperty("earth", "raster-opacity", 1 - blend);
    map.setPaintProperty("esri", "raster-opacity",
      ["interpolate", ["linear"], ["zoom"], 5, 0, 6.5, 1 - blend] as never);
    map.setPaintProperty("amap-satellite", "raster-opacity", blend);
    map.setPaintProperty("amap-road", "raster-opacity",
      ["interpolate", ["linear"], ["zoom"], 5, 0, 6, blend * 0.6] as never);
  } catch {}
}

// 落地默认台：优先选稳定可播的具体源，避免同名电台里排在前面的坏源被选中。
const DEFAULT_STATION_CANDIDATES = [
  { name: "中国之声", streamIncludes: "radio.0472.org/?id=639" },
  { name: "音乐之声", streamIncludes: "radio.0472.org/?id=641" },
  { name: "北京新闻广播", streamIncludes: "radio.0472.org/?id=353" },
];

function pickDefaultStation(stations: Station[], lng: number, lat: number): Station | null {
  for (const candidate of DEFAULT_STATION_CANDIDATES) {
    const station = stations.find(
      (s) => s.name === candidate.name && s.streamUrl?.includes(candidate.streamIncludes)
    );
    if (station) return station;
  }
  return nearestStation(stations, lng, lat);
}

function stationsToFC(stations: Station[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: stations.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: { id: s.id, name: s.name },
    })),
  };
}

function stationRadiusExpression(currentId: string | null): unknown[] {
  const isCurrent = ["==", ["get", "id"], ["literal", currentId ?? ""]];
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    2,
    ["case", isCurrent, 4.4, 1.5],
    5,
    ["case", isCurrent, 5.2, 2.2],
    8,
    ["case", isCurrent, 6, 3.2],
  ];
}

function closestRenderedStationInReticle(map: MlMap): string | null {
  const canvas = map.getCanvas();
  const cx = canvas.clientWidth / 2;
  const cy = canvas.clientHeight / 2;
  const features = map.queryRenderedFeatures(
    [
      [cx - RETICLE_RADIUS_PX, cy - RETICLE_RADIUS_PX],
      [cx + RETICLE_RADIUS_PX, cy + RETICLE_RADIUS_PX],
    ],
    { layers: ["station-core"] }
  );

  let bestId: string | null = null;
  let bestPx = Infinity;
  const seen = new Set<string>();
  const { stationMap } = useRadio.getState();
  for (const feature of features) {
    const id = feature.properties?.id as string | undefined;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const station = stationMap.get(id);
    if (!station) continue;
    const p = map.project([station.lng, station.lat]);
    const dx = p.x - cx;
    const dy = p.y - cy;
    const px = Math.hypot(dx, dy);
    if (px <= RETICLE_RADIUS_PX && px < bestPx) {
      bestPx = px;
      bestId = id;
    }
  }
  return bestId;
}

export default function RadioMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  const flyToActiveRef = useRef(false);
  const flyToTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapFrameRef = useRef<number | null>(null);
  const stationCountRef = useRef(0);
  const autoTunedRef = useRef(false);
  const draggingRef = useRef(false);

  const currentId = useRadio((s) => s.currentStationId);
  const currentIdRef = useRef(currentId);
  currentIdRef.current = currentId;

  // Subscribe to station count for progressive map updates
  const stationCount = useRadio((s) => s.stations.length);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let mounted = true;

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [118.8, 32.1],
      zoom: 3.2,
      minZoom: 2.2,
      maxZoom: 18,
      pitch: 0,
      attributionControl: { compact: true },
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          amapSatellite: {
            type: "raster",
            tiles: [
              "https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",
              "https://webst02.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",
              "https://webst03.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",
              "https://webst04.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",
            ],
            tileSize: 256,
            maxzoom: 18,
            attribution: '© <a href="https://amap.com">高德地图</a>',
          },
          amapRoad: {
            type: "raster",
            tiles: [
              "https://webst01.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}",
              "https://webst02.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}",
              "https://webst03.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}",
              "https://webst04.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}",
            ],
            tileSize: 256,
            maxzoom: 18,
          },
          amapSatellite: {
            type: "raster",
            tiles: [
              "https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",
              "https://webst02.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",
              "https://webst03.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",
              "https://webst04.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",
            ],
            tileSize: 256,
            maxzoom: 18,
            attribution: '© <a href="https://amap.com">高德地图</a>',
          },
          amapRoad: {
            type: "raster",
            tiles: [
              "https://webst01.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}",
              "https://webst02.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}",
              "https://webst03.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}",
              "https://webst04.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}",
            ],
            tileSize: 256,
            maxzoom: 18,
          },
        },
        layers: [
          { id: "space", type: "background", paint: { "background-color": "#0a1a3a" } },
          { id: "amap-satellite", type: "raster", source: "amapSatellite" },
          {
            id: "amap-road",
            type: "raster",
            source: "amapRoad",
            paint: {
              "raster-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0, 6, 0.6],
            },
          },
          { id: "amap-satellite", type: "raster", source: "amapSatellite", paint: { "raster-opacity": 0 } },
          { id: "amap-road", type: "raster", source: "amapRoad", paint: { "raster-opacity": 0 } },
        ],
      },
    });
    mapRef.current = map;
    mapBridge.map = map;
    map.dragRotate.disable();

    map.on("load", async () => {
      try {
        map.setProjection({ type: "globe" } as never);
      } catch {}
      try {
        map.setSky({
          "sky-color": "#2e6fd6",
          "sky-horizon-blend": 0.8,
          "horizon-color": "#bcd6ff",
          "horizon-fog-blend": 0.8,
          "fog-color": "#0c1f47",
          "fog-ground-blend": 0.1,
          "atmosphere-blend": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0, 1,
            5, 0.8,
            6, 0.5,
          ],
        } as never);
      } catch {}

      map.addSource("stations", { type: "geojson", data: EMPTY_FC });
      // 保留图层占位用于将来扩展；当前外圈由中心 reticle 呈现，避免点层发虚。
      map.addLayer({
        id: "station-glow",
        type: "circle",
        source: "stations",
        paint: {
          "circle-radius": 0,
          "circle-color": "#1ed760",
          "circle-blur": 0,
          "circle-opacity": 0,
        },
      });
      // 实心点：普通台更接近 Radio Garden 的低调点状密度，选中态由中心环强化。
      map.addLayer({
        id: "station-core",
        type: "circle",
        source: "stations",
        paint: {
          "circle-radius": stationRadiusExpression(currentIdRef.current) as never,
          "circle-color": [
            "case",
            ["==", ["get", "id"], ["literal", currentIdRef.current ?? ""]],
            "#d8ffe0", "#47f278",
          ],
          "circle-opacity": [
            "case",
            ["==", ["get", "id"], ["literal", currentIdRef.current ?? ""]],
            0.95, 0.88,
          ],
          "circle-stroke-width": [
            "case",
            ["==", ["get", "id"], ["literal", currentIdRef.current ?? ""]],
            1, 0,
          ],
          "circle-stroke-color": "#2cff69",
        },
      });

      readyRef.current = true;
      map.triggerRepaint();

      const clearFlyToLock = (delay = SNAP_DURATION_MS + 90) => {
        if (flyToTimerRef.current) clearTimeout(flyToTimerRef.current);
        flyToTimerRef.current = setTimeout(() => {
          flyToActiveRef.current = false;
        }, delay);
      };

      const snapStationToReticle = (id: string, source: "tune" | "select") => {
        const station = useRadio.getState().getStation(id);
        if (!station) return;
        flyToActiveRef.current = true;
        if (id !== currentIdRef.current) {
          useRadio.getState().setCurrent(id, source);
        }
        map.easeTo({
          center: [station.lng, station.lat],
          duration: SNAP_DURATION_MS,
          easing: (t) => 1 - (1 - t) ** 3,
          essential: true,
        });
        clearFlyToLock();
      };

      const onClickPoint = (e: maplibregl.MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) snapStationToReticle(id, "select");
      };
      map.on("click", "station-core", onClickPoint);
      map.on("click", "station-glow", onClickPoint);
      for (const lyr of ["station-core", "station-glow"]) {
        map.on("mouseenter", lyr, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", lyr, () => (map.getCanvas().style.cursor = ""));
      }

      const scanReticleForStation = () => {
        snapFrameRef.current = null;
        if (draggingRef.current) return;
        if (flyToActiveRef.current) return;
        if (useRadio.getState().isPinned) return;
        if (useRadio.getState().stations.length === 0) return;
        const id = closestRenderedStationInReticle(map);
        if (id) snapStationToReticle(id, "tune");
      };

      const queueReticleScan = () => {
        if (snapFrameRef.current != null || flyToActiveRef.current) return;
        snapFrameRef.current = requestAnimationFrame(scanReticleForStation);
      };

      // 用户主动拖动时：标记拖动中并释放 flyToActiveRef 锁，让拖动结束后的 moveend
      // 能正常触发磁吸。否则冷启动选中默认台后的 5.5s flyTo 锁会让磁吸全程被
      // scanReticleForStation 的 early-return 跳过，表现为“划不动/没磁吸”。
      // 注意：不要在此调用 map.stop()——它会打断相机动画并立刻触发一次 moveend，
      // 在拖动过程中就把地图吸附拽回，反而表现为“一拖就锁死”。用户拖动本身已会
      // 自动打断进行中的 easeTo/flyTo，无需手动 stop。
      map.on("dragstart", () => {
        draggingRef.current = true;
        if (flyToTimerRef.current) clearTimeout(flyToTimerRef.current);
        flyToActiveRef.current = false;
      });
      // dragend 在指针抬起时触发，早于惯性结束的 moveend；此时解除拖动标记，
      // 让随后的 moveend 扫描得以吸附到准星圈内最近的台。
      map.on("dragend", () => {
        draggingRef.current = false;
      });

      // Radio Garden 风格的磁吸：仅在停止拖动后吸附，避免拖动中被中心圈反复拉回。
      map.on("moveend", queueReticleScan);

      // 根据视口位置切换瓦片源
      map.on("moveend", () => updateTileOpacity(map));
      updateTileOpacity(map);

      // Fetch ALL stations once
      await useRadio.getState().fetchAll();
      if (!mounted) return;

      // Update map sources with all stations
      const { stations } = useRadio.getState();
      const stSrc = map.getSource("stations");
      if (stSrc && stSrc.type === "geojson") {
        (stSrc as maplibregl.GeoJSONSource).setData(stationsToFC(stations));
      }

      // Fallback auto-tune (若渐进更新尚未选中任何台)
      if (!autoTunedRef.current && !useRadio.getState().currentStationId) {
        const c = map.getCenter();
        const near = pickDefaultStation(stations, c.lng, c.lat);
        if (near) {
          autoTunedRef.current = true;
          snapStationToReticle(near.id, "tune");
        }
      }
    });

    return () => {
      mounted = false;
      if (snapFrameRef.current != null) cancelAnimationFrame(snapFrameRef.current);
      if (flyToTimerRef.current) clearTimeout(flyToTimerRef.current);
      map.remove();
      mapRef.current = null;
      mapBridge.map = null;
      readyRef.current = false;
    };
  }, []);

  // Selection highlight + flyTo
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    const id = currentId ?? "";
    map.setPaintProperty("station-glow", "circle-radius", 0);
    map.setPaintProperty("station-glow", "circle-opacity", 0);
    map.setPaintProperty("station-core", "circle-radius", stationRadiusExpression(id));
    map.setPaintProperty("station-core", "circle-color", [
      "case", ["==", ["get", "id"], ["literal", id]], "#d8ffe0", "#47f278",
    ]);
    map.setPaintProperty("station-core", "circle-opacity", [
      "case", ["==", ["get", "id"], ["literal", id]], 0.95, 0.88,
    ]);
    map.setPaintProperty("station-core", "circle-stroke-width", [
      "case", ["==", ["get", "id"], ["literal", id]], 1, 0,
    ]);

    const { lastChange } = useRadio.getState();
    const st = useRadio.getState().getStation(currentId ?? "");
    if (st && lastChange === "select") {
      flyToActiveRef.current = true;
      if (flyToTimerRef.current) clearTimeout(flyToTimerRef.current);
      map.flyTo({ center: [st.lng, st.lat], zoom: Math.max(map.getZoom(), 4), essential: true });
      // Reset after flyTo animation completes (max ~5s) + buffer
      flyToTimerRef.current = setTimeout(() => {
        flyToActiveRef.current = false;
      }, 5500);
    }
    // 注意：不要在此 effect 的 cleanup 里 clearTimeout(flyToTimerRef)。
    // 它会在每次 currentId 变化时取消“复位 flyToActiveRef”的定时器，
    // 导致磁吸吸附一次后 flyToActiveRef 永久卡在 true、磁吸失效。
    // 该定时器已在组件卸载的总 cleanup 中清理。
  }, [currentId]);

  // Update map sources when stations change (progressive loading)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (stationCount === stationCountRef.current) return;
    stationCountRef.current = stationCount;

    const { stations } = useRadio.getState();
    const stSrc = map.getSource("stations");
    if (stSrc && stSrc.type === "geojson") {
      (stSrc as maplibregl.GeoJSONSource).setData(stationsToFC(stations));
    }

    // 首批数据到达就立即调谐到地图中心最近的台，无需等全量加载完，
    // 避免初始长时间“加载中 / 旋转地球”的空状态。
    if (!autoTunedRef.current && !useRadio.getState().currentStationId && stations.length > 0) {
      const c = map.getCenter();
      const near = pickDefaultStation(stations, c.lng, c.lat);
      if (near) {
        autoTunedRef.current = true;
        useRadio.getState().setCurrent(near.id, "tune");
      }
    }
  }, [stationCount]);

  return <div ref={containerRef} className="map-root" />;
}
