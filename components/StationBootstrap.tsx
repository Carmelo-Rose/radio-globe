"use client";

import { useEffect } from "react";
import { useRadio } from "@/lib/store";

/**
 * UI-free startup bootstrap: make a known playable station available before
 * the map finishes loading, then let the normal fetch pipeline refresh data.
 */
export default function StationBootstrap() {
  useEffect(() => {
    const radio = useRadio.getState();
    radio.seedBootstrapStations();
    void radio.fetchAll();
  }, []);

  return null;
}
