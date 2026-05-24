"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import type { Station } from "@/lib/stations";
import { nearestStation } from "@/lib/geo";
import { useRadio } from "@/lib/store";
import { mapBridge } from "@/lib/mapBridge";

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

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

export default function RadioMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  const flyToActiveRef = useRef(false);
  const flyToTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stationCountRef = useRef(0);

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
      center: [116.4, 39.9],
      zoom: 3.2,
      minZoom: 2.2,
      maxZoom: 18,
      pitch: 0,
      attributionControl: { compact: true },
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          earth: {
            type: "raster",
            tiles: [
              "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
            ],
            tileSize: 256,
            maxzoom: 8,
            attribution:
              'Imagery © <a href="https://earthdata.nasa.gov/gibs">NASA EOSDIS GIBS</a> · Blue Marble',
          },
          esri: {
            type: "raster",
            tiles: [
              "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution:
              'High-res © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
          },
        },
        layers: [
          { id: "space", type: "background", paint: { "background-color": "#0a1a3a" } },
          { id: "earth", type: "raster", source: "earth", paint: { "raster-saturation": -0.15 } },
          {
            id: "esri",
            type: "raster",
            source: "esri",
            minzoom: 5,
            paint: {
              "raster-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0, 6.5, 1],
            },
          },
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
      // 外发光：仅选中的台有明显光晕，其余为很淡的小绿晕（Radio Garden 风格）
      map.addLayer({
        id: "station-glow",
        type: "circle",
        source: "stations",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "id"], ["literal", currentIdRef.current ?? ""]],
            14, 5,
          ],
          "circle-color": "#1ed760",
          "circle-blur": 1,
          "circle-opacity": [
            "case",
            ["==", ["get", "id"], ["literal", currentIdRef.current ?? ""]],
            0.55, 0.3,
          ],
        },
      });
      // 实心点：精确落在真实电台位置；非选中为小绿点（无白圈），选中为白点
      map.addLayer({
        id: "station-core",
        type: "circle",
        source: "stations",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "id"], ["literal", currentIdRef.current ?? ""]],
            6,
            ["interpolate", ["linear"], ["zoom"], 2, 2.8, 6, 4],
          ],
          "circle-color": [
            "case",
            ["==", ["get", "id"], ["literal", currentIdRef.current ?? ""]],
            "#ffffff", "#39ee78",
          ],
          "circle-stroke-width": [
            "case",
            ["==", ["get", "id"], ["literal", currentIdRef.current ?? ""]],
            2, 0,
          ],
          "circle-stroke-color": "rgba(255,255,255,0.9)",
        },
      });

      readyRef.current = true;
      map.triggerRepaint();

      const onClickPoint = (e: maplibregl.MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) useRadio.getState().setCurrent(id, "select");
      };
      map.on("click", "station-core", onClickPoint);
      map.on("click", "station-glow", onClickPoint);
      for (const lyr of ["station-core", "station-glow"]) {
        map.on("mouseenter", lyr, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", lyr, () => (map.getCanvas().style.cursor = ""));
      }

      // moveend: only auto-tune nearest station from already-loaded data
      map.on("moveend", () => {
        if (flyToActiveRef.current) return;
        const { stations } = useRadio.getState();
        if (stations.length === 0) return;
        const c = map.getCenter();
        const near = nearestStation(stations, c.lng, c.lat);
        if (near) useRadio.getState().setCurrent(near.id, "tune");
      });

      // Fetch ALL stations once
      await useRadio.getState().fetchAll();
      if (!mounted) return;

      // Update map sources with all stations
      const { stations } = useRadio.getState();
      const stSrc = map.getSource("stations");
      if (stSrc && stSrc.type === "geojson") {
        (stSrc as maplibregl.GeoJSONSource).setData(stationsToFC(stations));
      }

      // Auto-tune nearest station
      const c = map.getCenter();
      const near = nearestStation(stations, c.lng, c.lat);
      if (near) useRadio.getState().setCurrent(near.id, "tune");
    });

    return () => {
      mounted = false;
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
    map.setPaintProperty("station-glow", "circle-radius", [
      "case", ["==", ["get", "id"], ["literal", id]], 14, 5,
    ]);
    map.setPaintProperty("station-glow", "circle-opacity", [
      "case", ["==", ["get", "id"], ["literal", id]], 0.55, 0.3,
    ]);
    map.setPaintProperty("station-core", "circle-radius", [
      "case",
      ["==", ["get", "id"], ["literal", id]],
      6,
      ["interpolate", ["linear"], ["zoom"], 2, 2.8, 6, 4],
    ]);
    map.setPaintProperty("station-core", "circle-color", [
      "case", ["==", ["get", "id"], ["literal", id]], "#ffffff", "#39ee78",
    ]);
    map.setPaintProperty("station-core", "circle-stroke-width", [
      "case", ["==", ["get", "id"], ["literal", id]], 2, 0,
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
  }, [stationCount]);

  return <div ref={containerRef} className="map-root" />;
}
