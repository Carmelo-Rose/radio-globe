import type { Station } from "./stations";

export type ChinaRadioHealthStatus = "frozen" | "broken" | "unstable";

type ChinaRadioHealthEntry = {
  status: ChinaRadioHealthStatus;
  reason: string;
};

/**
 * China station health overrides.
 *
 * `frozen` means the stream resolves but the live playlist stops advancing, so
 * playback can hang in buffering. Hide these by default.
 *
 * `broken` means a station from the unstable set was confirmed unplayable on a
 * real device. Hide these by default as well.
 *
 * `unstable` is reserved for error/no_stream stations that should be retested
 * before removing from the health list. Hide them for now to protect playback.
 */
export const CHINA_RADIO_HEALTH_OVERRIDES: Record<string, ChinaRadioHealthEntry> = {
  "cn-0472-379": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 河北经济广播
  "cn-0472-383": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 河北文艺广播
  "cn-0472-384": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 保定经济广播
  "cn-0472-385": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 保定新闻广播
  "cn-0472-386": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 保定交通广播
  "cn-0472-387": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 保定城市服务广播
  "cn-0472-397": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 河南旅游广播·私家车999
  "cn-0472-471": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 福建音乐广播
  "cn-0472-484": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 甘肃都市调频
  "cn-0472-485": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 甘肃青春调频
  "cn-0472-510": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 江西都市广播
  "cn-0472-512": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 江西民生广播
  "cn-0472-513": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 江西农村广播
  "cn-0472-524": {
    status: "broken",
    reason: "confirmed unplayable on real device after health check returned error",
  }, // 芒果时空音乐台
  "cn-0472-562": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 陕西戏曲广播
  "cn-0472-566": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 陕西都市广播
  "cn-0472-573": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 内蒙古评书曲艺广播
  "cn-0472-577": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 内蒙古经济生活广播
  "cn-0472-595": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 云南旅游广播
  "cn-0472-598": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 云南教育广播
  "cn-0472-652": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 阅读之声
  "cn-0472-689": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 轻松调频
  "cn-0472-756": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 中国交通广播（陕西）
  "cn-0472-776": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 石家庄经济广播
  "cn-0472-777": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 石家庄交通广播
  "cn-0472-803": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 呼和浩特文艺广播
  "cn-0472-844": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 上海故事广播
  "cn-0472-845": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 五星体育广播
  "cn-0472-852": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 镇江经济广播
  "cn-0472-860": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 镇江文艺广播
  "cn-0472-861": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 镇江交通广播
  "cn-0472-863": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 盐城交通广播
  "cn-0472-876": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 南通经济广播
  "cn-0472-934": {
    status: "frozen",
    reason: "user reported unplayable; separate health report classified it as frozen",
  }, // 杭州老朋友广播
  "cn-0472-958": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 厦门闽南之声
  "cn-0472-973": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 赣州农村科教广播
  "cn-0472-1007": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 青岛广播爱车940
  "cn-0472-1032": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 宜昌交通广播
  "cn-0472-1033": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 宜昌音乐生活广播
  "cn-0472-1040": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 武汉交通广播
  "cn-0472-1057": {
    status: "broken",
    reason: "confirmed unplayable on real device after health check returned error",
  }, // 975摩登音乐台
  "cn-0472-1067": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 佛山电台924
  "cn-0472-1083": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 柳州交通广播
  "cn-0472-1092": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 南宁快乐895
  "cn-0472-1094": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 南宁经典1049
  "cn-0472-1133": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 陕西故事广播
  "cn-0472-1146": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 青海生活广播花儿调频
  "cn-0472-1156": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 新疆故事广播
  "cn-0472-1160": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 新疆老年广播
  "cn-0472-1189": {
    status: "broken",
    reason: "confirmed unplayable on real device after health check returned error",
  }, // 延边交通文艺广播
  "cn-0472-1272": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 吉林教育广播
  "cn-0472-1281": {
    status: "broken",
    reason: "confirmed unplayable on real device after health check returned error",
  }, // 贵阳旅游生活广播
  "cn-0472-1291": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 陕西秦腔广播
  "cn-0472-1310": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // KFM981
  "cn-0472-1317": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 浦江之声广播
  "cn-0472-1349": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 佛山电台906
  "cn-0472-1351": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 佛山电台901
  "cn-0472-1352": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 佛山电台946
  "cn-0472-1353": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 佛山电台883
  "cn-0472-1354": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 佛山电台985
  "cn-0472-1372": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 钦州城市之声
  "cn-0472-1373": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 钦州海豚之声
  "cn-0472-1386": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 菏泽音乐广播
  "cn-0472-1419": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 湛江经济广播
  "cn-0472-1425": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 阳江旅游环保广播
  "cn-0472-1441": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 无锡都市生活广播
  "cn-0472-1447": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 十堰交通音乐广播
  "cn-0472-1448": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 十堰综合广播
  "cn-0472-1460": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 恩施综合广播
  "cn-0472-1461": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 恩施交通音乐广播
  "cn-0472-1462": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 鄂州广播电视台综合广播
  "cn-0472-1472": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 常熟广播
  "cn-0472-1483": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 漳州综合广播
  "cn-0472-1528": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 十堰旅游生活广播
  "cn-0472-1529": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 随州综合广播
  "cn-0472-1530": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 随州交通广播
  "cn-0472-1531": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 长沙音乐广播
  "cn-0472-1541": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 荆州音乐广播
  "cn-0472-1556": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 荆州901交通广播
  "cn-0472-1604": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 安顺交通广播
  "cn-0472-1641": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 宜昌新闻综合广播
  "cn-0472-1688": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 晋中交通文艺广播
  "cn-0472-1689": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 晋中综合广播
  "cn-0472-1698": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 成都新闻广播
  "cn-0472-1848": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 东莞音乐广播
  "cn-0472-1894": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 厦门新闻综合广播
  "cn-0472-1895": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 厦门旅游广播
  "cn-0472-1896": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 厦门经济交通广播
  "cn-0472-1948": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 黄冈新闻综合广播
  "cn-0472-1949": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 黄冈交通音乐广播
  "cn-0472-1955": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 伊犁广播电视台汉语经济广播
  "cn-0472-2008": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 襄阳综合广播
  "cn-0472-2032": {
    status: "frozen",
    reason: "HLS playlist did not advance in 12s health check",
  }, // 克拉玛依融媒FM92.6综合广播
  "cn-0472-2035": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 巴音郭楞综合广播
  "cn-0472-2184": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 蕲春人民广播电台
  "cn-0472-2196": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 清远农村广播
  "cn-0472-2298": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 乌鲁木齐974交通广播
  "cn-0472-2299": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 乌鲁木齐新闻广播
  "cn-0472-2300": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 乌鲁木齐旅游音乐广播
  "cn-0472-2307": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 尉氏交通音乐广播
  "cn-0472-2311": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 昆明NEW
  "cn-0472-2317": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 楚雄音乐广播
  "cn-0472-2397": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 年代音乐889
  "cn-0472-2557": {
    status: "unstable",
    reason: "health check returned error; retest before hiding",
  }, // 阿荣旗综合广播
  "cn-0472-3289": {
    status: "broken",
    reason: "confirmed unplayable on real device after health check returned error",
  }, // 新泰融媒体综合广播
};

export function getChinaRadioHealthStatus(
  stationId: string
): ChinaRadioHealthStatus | null {
  return CHINA_RADIO_HEALTH_OVERRIDES[stationId]?.status ?? null;
}

export function isChinaRadioStationHidden(stationId: string): boolean {
  return getChinaRadioHealthStatus(stationId) != null;
}

export function filterHiddenChinaStations<T extends Pick<Station, "id">>(
  stations: T[]
): T[] {
  return stations.filter((station) => !isChinaRadioStationHidden(station.id));
}
