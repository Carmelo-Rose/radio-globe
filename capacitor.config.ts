import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.radioglobe.app",
  appName: "Radio Globe",
  webDir: "out",
  server: {
    // https 上下文让 WebView 里的 WebGL / IndexedDB 行为与浏览器一致
    androidScheme: "https",
  },
};

export default config;
