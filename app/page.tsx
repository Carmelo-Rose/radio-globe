"use client";

import dynamic from "next/dynamic";
import CenterReticle from "@/components/CenterReticle";
import InfoCard from "@/components/InfoCard";
import PlayerCard from "@/components/PlayerCard";
import StationList from "@/components/StationList";
import ZoomControls from "@/components/ZoomControls";

const RadioMap = dynamic(() => import("@/components/RadioMap"), { ssr: false });

export default function Page() {
  return (
    <main>
      <RadioMap />
      <CenterReticle />
      <ZoomControls />
      <div className="bottom-left">
        <InfoCard />
        <PlayerCard />
      </div>
      <StationList />
    </main>
  );
}
