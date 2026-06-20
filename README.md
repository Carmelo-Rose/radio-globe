# 🌍 Radio Globe

**旋转地球，听见世界。**

打开地图，转到你想去的地方，点击就能听当地的电台。

---

## ✨ 功能

- 🌐 **全球 70,000+ 电台** — 覆盖几乎所有国家和地区
- 🇨🇳 **600+ 中国电台** — 省市级精准定位，一键收听
- 🎵 **后台播放** — 锁屏、切应用都不中断
- 📱 **锁屏控制** — 不用解锁就能切台、暂停
- ⏰ **睡眠定时** — 设定时间，到点自动停止
- ❤️ **收藏电台** — 喜欢的台一键收藏，下次秒开
- 📍 **附近推荐** — 自动推荐你当前收听位置周边的电台

---

## 📲 怎么用

### Android 手机

1. 去 [Releases 页面](https://github.com/Carmelo-Rose/radio-globe/releases)
2. 下载 `radio-globe-debug.apk`
3. 打开安装（可能需要允许"安装未知来源应用"）
4. 打开 App，点击地球上的绿点，开始听

### 电脑 / 其他设备

需要 Node.js 22+ 和 npm 10+。

```bash
git clone https://github.com/Carmelo-Rose/radio-globe.git
cd radio-globe
npm install
npm run dev
```

浏览器打开 `http://localhost:3000` 即可体验。

构建静态版：

```bash
npm run build
```

输出到 `out/` 目录，可部署到任意静态托管服务。

---

## 🛠️ 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | Next.js 15 · React 19 · TypeScript |
| 状态管理 | Zustand |
| 地图引擎 | MapLibre GL JS 5 |
| 音频播放 | hls.js (Web) · @mediagrid/capacitor-native-audio (原生) |
| 原生壳 | Capacitor 8 (Android + iOS) |

## 📁 项目结构

```
app/                  # Next.js 页面
components/           # UI 组件（地图、播放器、列表）
lib/                  # 核心逻辑（状态管理、API、地理计算）
scripts/              # 构建脚本
android/              # Android 工程
ios/                  # iOS 工程
```

---

Made with ❤️ for radio lovers everywhere.
