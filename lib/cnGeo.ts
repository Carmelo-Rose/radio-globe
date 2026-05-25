// 中国主要城市 -> 经纬度（城市中心，真实坐标）。
// 用于给 radio-browser 中无坐标的中国电台按"台名里的城市"补真实定位。
export const CN_CITIES: Record<string, [number, number]> = {
  北京: [116.41, 39.9],
  上海: [121.47, 31.23],
  广州: [113.26, 23.13],
  深圳: [114.06, 22.54],
  杭州: [120.15, 30.27],
  南京: [118.8, 32.06],
  成都: [104.07, 30.66],
  重庆: [106.55, 29.56],
  武汉: [114.3, 30.59],
  西安: [108.94, 34.34],
  天津: [117.2, 39.13],
  苏州: [120.62, 31.3],
  长沙: [112.94, 28.23],
  郑州: [113.62, 34.75],
  青岛: [120.38, 36.07],
  沈阳: [123.43, 41.8],
  大连: [121.62, 38.91],
  厦门: [118.09, 24.48],
  宁波: [121.55, 29.87],
  无锡: [120.3, 31.57],
  福州: [119.3, 26.08],
  济南: [117.0, 36.65],
  哈尔滨: [126.53, 45.8],
  长春: [125.32, 43.82],
  昆明: [102.83, 24.88],
  南昌: [115.86, 28.68],
  合肥: [117.27, 31.86],
  石家庄: [114.51, 38.04],
  太原: [112.55, 37.87],
  贵阳: [106.63, 26.65],
  南宁: [108.37, 22.82],
  兰州: [103.83, 36.06],
  海口: [110.2, 20.04],
  三亚: [109.51, 18.25],
  珠海: [113.55, 22.27],
  佛山: [113.12, 23.02],
  东莞: [113.75, 23.04],
  温州: [120.7, 28.0],
  嘉兴: [120.76, 30.77],
  常州: [119.95, 31.78],
  徐州: [117.18, 34.26],
  烟台: [121.39, 37.54],
  潍坊: [119.16, 36.71],
  唐山: [118.18, 39.63],
  保定: [115.46, 38.87],
  洛阳: [112.45, 34.62],
  汕头: [116.68, 23.35],
  中山: [113.39, 22.52],
  惠州: [114.42, 23.11],
  台州: [121.43, 28.66],
  金华: [119.65, 29.08],
  绍兴: [120.58, 30.01],
  泉州: [118.68, 24.87],
  南通: [120.86, 32.01],
  扬州: [119.42, 32.39],
  镇江: [119.45, 32.2],
};

// 省 / 自治区 / 直辖市 -> 省会(或中心)真实坐标。用于台名只含省份时定位。
// 键同时含全称与常见简称，按名字长度降序匹配，避免"广东"误伤"广"。
export const CN_PROVINCES: Record<string, [number, number]> = {
  黑龙江: [126.53, 45.8], // 哈尔滨
  内蒙古: [111.75, 40.84], // 呼和浩特
  黑龙: [126.53, 45.8],
  广东: [113.26, 23.13], // 广州
  广西: [108.37, 22.82], // 南宁
  山东: [117.0, 36.65], // 济南
  山西: [112.55, 37.87], // 太原
  河南: [113.62, 34.75], // 郑州
  河北: [114.51, 38.04], // 石家庄
  湖南: [112.94, 28.23], // 长沙
  湖北: [114.3, 30.59], // 武汉
  江苏: [118.8, 32.06], // 南京
  江西: [115.86, 28.68], // 南昌
  浙江: [120.15, 30.27], // 杭州
  福建: [119.3, 26.08], // 福州
  安徽: [117.27, 31.86], // 合肥
  四川: [104.07, 30.66], // 成都
  贵州: [106.63, 26.65], // 贵阳
  云南: [102.83, 24.88], // 昆明
  陕西: [108.94, 34.34], // 西安
  甘肃: [103.83, 36.06], // 兰州
  青海: [101.78, 36.62], // 西宁
  宁夏: [106.27, 38.47], // 银川
  新疆: [87.62, 43.79], // 乌鲁木齐
  西藏: [91.11, 29.66], // 拉萨
  辽宁: [123.43, 41.8], // 沈阳
  吉林: [125.32, 43.82], // 长春
  海南: [110.2, 20.04], // 海口
  台湾: [121.52, 25.04], // 台北
  香港: [114.17, 22.32],
  澳门: [113.55, 22.2],
};

// 全国性广播网/卫视：无具体城市，统一落到对应中心点。
const NATIONAL_KEYWORDS = [
  "中国之声", "经济之声", "音乐之声", "中华之声", "神州之声",
  "央广", "CNR", "CCTV", "中央", "国际", "环球", "凤凰", "China",
  "华语", "亚洲", "AsiaFM", "AisaFM", "粤语", "BBN",
];
const NATIONAL_CENTER: [number, number] = [116.41, 39.9]; // 北京

// 按名字长度降序，优先匹配更长的名字
const CITY_NAMES = Object.keys(CN_CITIES).sort((a, b) => b.length - a.length);
const PROVINCE_NAMES = Object.keys(CN_PROVINCES).sort((a, b) => b.length - a.length);
// 兜底用：把无法定位的台稳定散布到这些真实城市，避免落到海里/无人区
const FALLBACK_CITIES = Object.values(CN_CITIES);

/** 从电台名中找出它所属的中国城市；找不到返回 null */
export function matchCity(name: string): { city: string; lng: number; lat: number } | null {
  for (const c of CITY_NAMES) {
    if (name.includes(c)) {
      const [lng, lat] = CN_CITIES[c];
      return { city: c, lng, lat };
    }
  }
  return null;
}

/** 从电台名中找出它所属的省份(落到省会)；找不到返回 null */
export function matchProvince(name: string): { city: string; lng: number; lat: number } | null {
  for (const p of PROVINCE_NAMES) {
    if (name.includes(p)) {
      const [lng, lat] = CN_PROVINCES[p];
      return { city: p, lng, lat };
    }
  }
  return null;
}

/** 是否为全国性台(央广/卫视/国际等)，无单一城市归属 */
export function isNationalStation(name: string): boolean {
  return NATIONAL_KEYWORDS.some((k) => name.includes(k));
}
export function nationalCenter(): { city: string; lng: number; lat: number } {
  return { city: "全国", lng: NATIONAL_CENTER[0], lat: NATIONAL_CENTER[1] };
}

/** 兜底：按 id 稳定分配到某个真实城市，保证点都在陆地上 */
export function fallbackCity(id: string): { city: string; lng: number; lat: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const [lng, lat] = FALLBACK_CITIES[Math.abs(h) % FALLBACK_CITIES.length];
  return { city: "中国", lng, lat };
}

/** 用字符串 id 生成稳定的小幅经纬度抖动（±~3km），让同城多个台不完全重叠 */
export function cityJitter(id: string): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const a = (h % 360) * (Math.PI / 180);
  const r = ((Math.abs(h >> 9) % 100) / 100) * 0.03; // 最大约 0.03°（≈3km）
  return [Math.cos(a) * r, Math.sin(a) * r];
}
