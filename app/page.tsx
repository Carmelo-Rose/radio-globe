"use client";

import dynamic from "next/dynamic";
import AudioEngine from "@/components/AudioEngine";
import StationList from "@/components/StationList";
import StartOverlay from "@/components/StartOverlay";
import StationBootstrap from "@/components/StationBootstrap";

const RadioMap = dynamic(() => import("@/components/RadioMap"), { ssr: false });
// 客户端渲染：Spectrum 用 Math.random 生成动画高度，SSR 会与客户端不一致。
const GlassOverlay = dynamic(() => import("@/components/glass/GlassOverlay"), { ssr: false });

export default function Page() {
  return (
    <main>
      <StationBootstrap />
      <RadioMap />
      <GlassOverlay />
      <StationList />
      <StartOverlay />
      <AudioEngine />
    </main>
  );
}
