import type { Map as MlMap } from "maplibre-gl";

// 简单的模块级桥接，让缩放按钮等 UI 组件能访问到地图实例。
export const mapBridge: { map: MlMap | null } = { map: null };
