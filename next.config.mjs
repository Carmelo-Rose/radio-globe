/** @type {import('next').NextConfig} */
const isNative = process.env.BUILD_TARGET === "native";

const nextConfig = {
  reactStrictMode: true,
  // 原生(Capacitor)构建为纯静态导出到 out/；Web/dev 构建保持默认（含 /api/stream 代理）。
  ...(isNative ? { output: "export", images: { unoptimized: true } } : {}),
};

export default nextConfig;
