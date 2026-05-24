import { NextRequest } from "next/server";

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

    // Detect offline streams: server returns HTML instead of audio
    if (contentType.includes("text/html")) {
      return new Response("STREAM_OFFLINE", {
        status: 502,
        headers: { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" },
      });
    }

    // For HLS manifests, rewrite segment URLs to go through proxy
    if (contentType.includes("mpegurl") || contentType.includes("m3u8") || url.endsWith(".m3u8")) {
      const text = await upstream.text();
      const base = new URL(".", url).href;
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
