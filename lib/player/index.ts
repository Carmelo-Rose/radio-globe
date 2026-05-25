import { Capacitor } from "@capacitor/core";
import type { RadioPlayer } from "./types";
import { WebPlayer } from "./webPlayer";

export type { RadioPlayer, PlayerHandlers, PlayerMeta, PlayerErrorKind } from "./types";

let instance: RadioPlayer | null = null;

/**
 * 返回当前平台的播放器单例。原生平台用 NativePlayer（原生流播放 + 后台/锁屏），
 * 其余（浏览器 / dev / PWA）用 WebPlayer（hls.js + /api/stream 代理）。
 * NativePlayer 走动态 import，避免把原生插件打进 Web 包。
 */
export async function getPlayer(): Promise<RadioPlayer> {
  if (instance) return instance;
  if (Capacitor.isNativePlatform()) {
    const { NativePlayer } = await import("./nativePlayer");
    instance = new NativePlayer();
  } else {
    instance = new WebPlayer();
  }
  return instance;
}
