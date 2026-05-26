import { NextRequest } from "next/server";

/**
 * 拒绝指向内部/私有网络的主机，防止 SSRF。返回 true 表示应拦截。
 * 注意：这是基于字面主机名/IP 的轻量防护（不做 DNS 解析），
 * 足以挡住明显的内网/环回/元数据目标，同时放行公网广播流。
 */
function isBlockedHost(hostnameRaw: string): boolean {
  const host = hostnameRaw.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  // 明确的内部主机名
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;

  // IPv6 环回 / 链路本地 / 唯一本地地址
  if (host === "::1" || host === "::") return true;
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
  // IPv4-mapped IPv6，如 ::ffff:127.0.0.1
  const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const ipv4 = mapped ? mapped[1] : host;

  // IPv4 私有 / 环回 / 链路本地 / 元数据
  const m = ipv4.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 0 || a === 127) return true; // 0.0.0.0/8, 环回
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // 链路本地 + 云元数据 169.254.169.254
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a >= 224) return true; // 组播 / 保留
  }

  return false;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new Response("Missing url parameter", { status: 400 });
  }

  // Validate URL is a radio stream
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  // Only allow http/https
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return new Response("Invalid protocol", { status: 400 });
  }

  // SSRF protection: 电台流来自全球成千上万的广播商域名，无法用白名单。
  // 改为黑名单：拒绝指向内网 / 环回 / 链路本地 / 云元数据等内部目标的地址，
  // 放行所有公网流媒体主机。
  if (isBlockedHost(parsed.hostname)) {
    return new Response("Host not allowed", { status: 403 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "RadioGlobe/0.1",
        Accept: "*/*",
        Referer: parsed.origin,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status}`, {
        status: upstream.status,
      });
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const ctLower = contentType.toLowerCase();

    // Detect offline streams: server returns HTML instead of audio
    if (ctLower.includes("text/html")) {
      return new Response("STREAM_OFFLINE", {
        status: 502,
        headers: { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" },
      });
    }

    // 跟随 302 后的最终地址：既用于判断是否 HLS，也用于解析相对分片路径。
    const finalUrl = upstream.url || url;
    let finalPath = "";
    try {
      finalPath = new URL(finalUrl).pathname.toLowerCase();
    } catch {
      /* ignore */
    }
    // HLS 判定：content-type 常不可靠（国内服务器多回 application/octet-stream），
    // 因此同时看跳转后最终 URL 的路径是否以 .m3u8 结尾。
    // 0472(radio.0472.org/?id=N) 跳到 ytcast2.radio.cn/.../index_N.m3u8 即由此命中。
    const isHlsManifest =
      ctLower.includes("mpegurl") ||
      ctLower.includes("m3u8") ||
      finalPath.endsWith(".m3u8") ||
      url.toLowerCase().endsWith(".m3u8");

    // For HLS manifests, rewrite segment URLs to go through proxy
    if (isHlsManifest) {
      const text = await upstream.text();
      // m3u8 里的分片是相对路径，必须相对跳转后的最终地址解析，否则分片 404。
      const base = new URL(".", finalUrl).href;
      const rewritten = text.replace(
        /^(?!#)(?!https?:\/\/)(.+\.m3u8|.+\.ts|.+)$/gm,
        (match) => {
          const absolute = new URL(match, base).href;
          return `/api/stream?url=${encodeURIComponent(absolute)}`;
        }
      );
      return new Response(rewritten, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
        },
      });
    }

    // Pipe audio stream directly
    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(`Proxy error: ${message}`, { status: 502 });
  }
}
