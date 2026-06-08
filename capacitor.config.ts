import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.radioglobe.app",
  appName: "Radio Globe",
  webDir: "out",
  server: {
    // https 上下文让 WebView 里的 WebGL / IndexedDB 行为与浏览器一致
    androidScheme: "https",
  },
  ios: {
    // 与 Android 保持一致，使用 https 方案
    scheme: "https",
    contentInset: "automatic",
    allowsLinkPreview: false,
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#000000",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "Dark",
      backgroundColor: "#00000000",
      overlaysWebView: true,
    },
  },
};

export default config;
