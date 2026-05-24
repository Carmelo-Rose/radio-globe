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

function ambientDots(stations: Station[]): GeoJSON.FeatureCollection {
  const capped = stations.slice(0, 60);
  return {
    type: "FeatureCollection",
    features: capped.flatMap((s) =>
      Array.from({ length: 48 }, () => {
        const r = Math.pow(Math.random(), 0.6) * 13;
        const a = Math.random() * Math.PI * 2;
        return {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [
              s.lng + (Math.cos(a) * r) / Math.cos((s.lat * Math.PI) / 180),
              Math.max(-83, Math.min(83, s.lat + Math.sin(a) * r)),
            ],
          },
          properties: {},
        };
      })
    ),
  };
}

export default function RadioMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  const flyToActiveRef = useRef(false);
  const flyToTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentId = useRadio((s) => s.currentStationId);
  const currentIdRef = useRef(currentId);
  currentIdRef.current = currentId;

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

      map.addSource("ambient", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "ambient-dots",
        type: "circle",
        source: "ambient",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1.5, 1.8, 6, 4],
          "circle-color": "#5dff95",
          "circle-opacity": 0.8,
          "circle-blur": 0.5,
        },
      });

      map.addSource("stations", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "station-glow",
        type: "circle",
        source: "stations",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "id"], ["literal", currentIdRef.current ?? ""]],
            18, 10,
          ],
          "circle-color": "#1ed760",
          "circle-blur": 1,
          "circle-opacity": 0.45,
        },
      });
      map.addLayer({
        id: "station-core",
        type: "circle",
        source: "stations",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "id"], ["literal", currentIdRef.current ?? ""]],
            7, 4.5,
          ],
          "circle-color": [
            "case",
            ["==", ["get", "id"], ["literal", currentIdRef.current ?? ""]],
            "#ffffff", "#1ed760",
          ],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "rgba(255,255,255,0.85)",
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
      const amSrc = map.getSource("ambient");
      if (stSrc && stSrc.type === "geojson") {
        (stSrc as maplibregl.GeoJSONSource).setData(stationsToFC(stations));
      }
      if (amSrc && amSrc.type === "geojson") {
        (amSrc as maplibregl.GeoJSONSource).setData(ambientDots(stations));
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
      "case", ["==", ["get", "id"], ["literal", id]], 18, 10,
    ]);
    map.setPaintProperty("station-core", "circle-radius", [
      "case", ["==", ["get", "id"], ["literal", id]], 7, 4.5,
    ]);
    map.setPaintProperty("station-core", "circle-color", [
      "case", ["==", ["get", "id"], ["literal", id]], "#ffffff", "#1ed760",
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

  return <div ref={containerRef} className="map-root" />;
}
