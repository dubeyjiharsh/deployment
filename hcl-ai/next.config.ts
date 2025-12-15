import type { NextConfig } from "next";

// Get Hocuspocus URL for CSP (allow WebSocket connections)
const hocuspocusUrl = process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || "";
let hocuspocusHost = "";
if (hocuspocusUrl) {
  try {
    hocuspocusHost = new URL(hocuspocusUrl).host;
  } catch (err) {
    console.warn("[next.config] Invalid NEXT_PUBLIC_HOCUSPOCUS_URL; WebSocket CSP entry skipped");
  }
}

const nextConfig: NextConfig = {
  output: "standalone", // Required for Docker deployment
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  webpack: (config) => {
    // Stub html2canvas to avoid bundling optional dependency from jspdf in server routes
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      html2canvas: require.resolve("./lib/html2canvas-stub.js"),
    };
    return config;
  },
  async headers() {
    // Build connect-src with WebSocket support for collaboration
    const connectSrc = ["'self'"];
    if (hocuspocusHost) {
      connectSrc.push(`ws://${hocuspocusHost}`);
      connectSrc.push(`wss://${hocuspocusHost}`);
    }
    // Allow localhost WebSocket for development
    if (process.env.NODE_ENV === "development") {
      connectSrc.push("ws://localhost:*");
      connectSrc.push("ws://127.0.0.1:*");
    }

    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline/eval
              "style-src 'self' 'unsafe-inline'", // Required for styled components
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              `connect-src ${connectSrc.join(" ")}`,
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
      {
        // CORS headers for API routes
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.ALLOWED_ORIGINS || "http://localhost:3000",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
          {
            key: "Access-Control-Max-Age",
            value: "86400", // 24 hours
          },
        ],
      },
    ];
  },
};

export default nextConfig;
