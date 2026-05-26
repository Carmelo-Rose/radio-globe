export type Station = {
  id: string;
  name: string;
  city: string;
  country: string;
  lng: number;
  lat: number;
  timeZone: string;
  genre: string;
  streamUrl?: string;
};

// 冷启动兜底台：从内置的 0472 国内源里挑稳定可播的国家台/一线城市台。
// 故意复用 chinaRadioData.ts 中相同的 id，待全量数据加载后 Map 去重会无缝合并，
// 不产生重复条目。第 0 个为冷启动默认选中台（见 store.ts fetchAll）。
export const BOOTSTRAP_STATIONS: Station[] = [
  { id: "cn-0472-639", name: "中国之声", city: "全国", country: "中国", lng: 116.4266, lat: 39.9023, timeZone: "Asia/Shanghai", genre: "央广", streamUrl: "https://radio.0472.org/?id=639" },
  { id: "cn-0472-641", name: "音乐之声", city: "全国", country: "中国", lng: 116.4244, lat: 39.9087, timeZone: "Asia/Shanghai", genre: "央广", streamUrl: "https://radio.0472.org/?id=641" },
  { id: "cn-0472-640", name: "经济之声", city: "全国", country: "中国", lng: 116.4245, lat: 39.9084, timeZone: "Asia/Shanghai", genre: "央广", streamUrl: "https://radio.0472.org/?id=640" },
  { id: "cn-0472-353", name: "北京新闻广播", city: "北京", country: "中国", lng: 116.4174, lat: 39.9134, timeZone: "Asia/Shanghai", genre: "北京", streamUrl: "https://radio.0472.org/?id=353" },
  { id: "cn-0472-849", name: "上海新闻广播", city: "上海", country: "中国", lng: 121.453, lat: 31.2359, timeZone: "Asia/Shanghai", genre: "上海", streamUrl: "https://radio.0472.org/?id=849" },
];
