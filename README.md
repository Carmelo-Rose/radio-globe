# Radio Globe

旋转地球，调谐世界各地的电台。

一个基于 MapLibre GL 的交互式电台地球仪，支持全球 70,000+ 电台实时浏览、播放与收藏。提供 Web、Android、iOS 三端体验。

## 功能

- **3D 地球浏览** — 基于 MapLibre GL，支持中国区域高清瓦片（天地图）与全球 NASA/Esri 瓦片无缝切换
- **海量电台** — 接入 [Radio Browser](https://www.radio-browser.info/) 公共 API，覆盖全球电台
- **中国电台专区** — 内置 600+ 中国省市电台，含坐标定位与健康检测
- **智能播放** — 支持 HLS 流、MP3/AAC 直链；原生端与 Web 端均具备卡顿自动跳台
- **睡眠定时器** — 设定停止时间，到点自动暂停播放
- **收藏 & 最近收听** — 本地持久化，跨会话保留
- **附近电台** — 基于当前收听位置，推荐周边电台
- **锁屏控制** — iOS/Android 原生音频会话，支持锁屏播放、控制中心操作
- **后台播放** — 切到后台或锁屏后音频不中断

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | Next.js 15 · React 19 · TypeScript |
| 状态管理 | Zustand |
| 地图引擎 | MapLibre GL JS 5 |
| 音频播放 | hls.js (Web) · @mediagrid/capacitor-native-audio (原生) |
| 原生壳 | Capacitor 8 (Android + iOS) |
| 样式 | CSS-in-JS (glass morphism) |

## 项目结构

```
app/                  # Next.js App Router 页面
  layout.tsx          # 根布局、字体、viewport 配置
  page.tsx            # 主页面入口
  globals.css         # 全局样式、safe-area 适配
components/           # UI 组件
  RadioMap.tsx        # MapLibre 地球 + 电台标注
  AudioEngine.tsx     # 音频播放引擎（Web 端）
  StationList.tsx     # 电台列表抽屉
  StartOverlay.tsx    # 首次启动引导
  glass/              # Glass morphism 桌面/移动端 UI
lib/                  # 核心逻辑
  store.ts            # Zustand 全局状态
  radioApi.ts         # Radio Browser API 封装
  stations.ts         # 电台数据模型
  chinaRadioData.ts   # 中国电台静态数据
  chinaRadioHealth.ts # 中国电台健康检测
  geo.ts              # 地理计算（附近电台等）
  mapBridge.ts        # 地图 ↔ UI 通信桥
scripts/              # 构建 & 运维脚本
android/              # Capacitor Android 工程
ios/                  # Capacitor iOS 工程
```

## 快速开始

### 环境要求

- Node.js >= 22
- npm >= 10

### 安装 & 开发

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:3000`。

### 构建 Web 静态版

```bash
npm run build
```

输出到 `out/` 目录，可直接部署到任意静态托管。

## 原生构建

### Android

```bash
# 1. 构建静态资源并同步到 Android 工程
npm run build:native

# 2. 编译 Debug APK
cd android && ./gradlew assembleDebug

# APK 输出在 android/app/build/outputs/apk/debug/app-debug.apk
```

### iOS

需要 macOS + Xcode。

```bash
# 1. 构建静态资源并同步到 iOS 工程
npm run build:native

# 2. 打开 Xcode 工程
npx cap open ios
```

在 Xcode 中选择模拟器或真机，点击 Run。

## 脚本说明

| 命令 | 用途 |
|---|---|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建 Web 静态站点 |
| `npm run build:native` | 构建静态资源 + cap sync（自动处理 API 目录兼容） |
| `npm run check:china-radio-health` | 检测中国电台流可用性 |
| `npm run check:china-radio-unstable` | 仅列出不稳定的中国电台 |

## 分支策略

| 分支 | 用途 |
|---|---|
| `master` | 稳定主线 |
| `china-radio` | 中国电台功能开发（已合并至 master） |

## 调试 APK

仓库内置 `radio-globe-debug.apk`（通过 Git LFS 管理），可直接下载安装体验。

## License

MIT
